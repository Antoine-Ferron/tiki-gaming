package fr.tikigaming.realtime;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Déduplication d'une action par (scope, identifiant d'action) : un double clic ou le renvoi de la même action
 * (coupure réseau, retentative) n'est traité qu'une fois. L'identifiant est oublié après {@link #RETENTION}.
 */
@Component
public class IdempotencyGuard {

    static final Duration RETENTION = Duration.ofMinutes(5);

    private record Key(String scope, String actionId) {}

    private final ConcurrentHashMap<Key, Instant> seenAt = new ConcurrentHashMap<>();
    private final Clock clock;

    public IdempotencyGuard() {
        this(Clock.systemUTC());
    }

    IdempotencyGuard(Clock clock) {
        this.clock = clock;
    }

    /** Vrai la première fois (dans la fenêtre de rétention) que cet identifiant est vu pour ce scope. */
    public boolean isFirst(String scope, String actionId) {
        purgeExpired();
        return seenAt.putIfAbsent(new Key(scope, actionId), clock.instant()) == null;
    }

    private void purgeExpired() {
        Instant cutoff = clock.instant().minus(RETENTION);
        seenAt.values().removeIf(instant -> !instant.isAfter(cutoff));
    }
}
