package fr.tikigaming.resilience;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.function.Predicate;
import java.util.function.Supplier;

/**
 * Disjoncteur (circuit breaker) devant une dépendance distante, pour qu'une panne de Supabase ne bloque pas les
 * threads du backend en attendant des timeouts :
 *
 * <ul>
 *   <li><b>fermé</b> : les appels passent ; {@code failureThreshold} pannes consécutives l'ouvrent ;
 *   <li><b>ouvert</b> : les appels sont refusés tout de suite ({@link CircuitOpenException}), sans réseau, pendant
 *       {@code openDuration} ;
 *   <li><b>semi-ouvert</b> : passé ce délai, un seul appel d'essai passe ; s'il réussit le circuit se referme,
 *       sinon il se rouvre pour un délai complet.
 * </ul>
 *
 * <p>Seules les exceptions reconnues par {@code isOutage} sont des pannes : un refus métier prouve que la
 * dépendance répond, il compte comme un succès.
 */
public final class CircuitBreaker {

    public enum State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    private final int failureThreshold;
    private final Duration openDuration;
    private final Clock clock;
    private final Predicate<RuntimeException> isOutage;

    private State state = State.CLOSED;
    private int consecutiveFailures;
    private Instant openedAt;

    public CircuitBreaker(
            int failureThreshold, Duration openDuration, Clock clock, Predicate<RuntimeException> isOutage) {
        if (failureThreshold < 1) throw new IllegalArgumentException("failureThreshold doit valoir au moins 1");
        if (openDuration.isNegative() || openDuration.isZero()) {
            throw new IllegalArgumentException("openDuration doit être positive");
        }
        this.failureThreshold = failureThreshold;
        this.openDuration = openDuration;
        this.clock = clock;
        this.isOutage = isOutage;
    }

    public synchronized State state() {
        return state;
    }

    /** Exécute {@code action} si le circuit le permet ; ses exceptions sont relancées telles quelles. */
    public <T> T call(Supplier<T> action) {
        acquire();
        T result;
        try {
            result = action.get();
        } catch (RuntimeException e) {
            if (isOutage.test(e)) onFailure();
            else onSuccess();
            throw e;
        }
        onSuccess();
        return result;
    }

    private synchronized void acquire() {
        if (state == State.CLOSED) return;
        Instant retryAt = openedAt.plus(openDuration);
        Instant now = clock.instant();
        // Semi-ouvert : l'essai est en cours, les autres appels attendent son verdict.
        if (state == State.HALF_OPEN || now.isBefore(retryAt)) {
            throw new CircuitOpenException(state == State.HALF_OPEN ? Duration.ZERO : Duration.between(now, retryAt));
        }
        state = State.HALF_OPEN;
    }

    private synchronized void onSuccess() {
        state = State.CLOSED;
        consecutiveFailures = 0;
    }

    private synchronized void onFailure() {
        consecutiveFailures++;
        if (state == State.HALF_OPEN || consecutiveFailures >= failureThreshold) {
            state = State.OPEN;
            openedAt = clock.instant();
            consecutiveFailures = 0;
        }
    }
}
