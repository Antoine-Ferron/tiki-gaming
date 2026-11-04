package fr.tikigaming.realtime;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.stereotype.Component;

/**
 * Déduplication d'une action par (scope, identifiant d'action) : un double clic ou le renvoi de la même action
 * (coupure réseau, retentative) n'est traité qu'une fois. L'identifiant est oublié après {@link #RETENTION}.
 *
 * <p>La fraîcheur d'une entrée est toujours vérifiée au cas par cas dans {@link #isFirst} (une entrée expirée est
 * traitée comme absente, que le nettoyage périodique soit déjà passé ou non) : {@link #purgeIfDue} ne sert qu'à
 * borner la mémoire en oubliant les clés que plus personne n'interroge, pas à décider si une action est nouvelle.
 */
@Component
public class IdempotencyGuard {

    static final Duration RETENTION = Duration.ofMinutes(5);
    // Le nettoyage parcourt toute la table : pas la peine de le refaire à chaque action relayée, sur le chemin
    // le plus chaud du socle. Il suffit qu'il tourne plus souvent que RETENTION pour rester borné.
    static final Duration PURGE_INTERVAL = Duration.ofSeconds(30);

    private record Key(String scope, String actionId) {}

    private final ConcurrentHashMap<Key, Instant> seenAt = new ConcurrentHashMap<>();
    private final AtomicReference<Instant> lastPurge;
    private final AtomicInteger purgeRuns = new AtomicInteger();
    private final Clock clock;

    public IdempotencyGuard() {
        this(Clock.systemUTC());
    }

    IdempotencyGuard(Clock clock) {
        this.clock = clock;
        this.lastPurge = new AtomicReference<>(clock.instant());
    }

    /** Vrai la première fois (dans la fenêtre de rétention) que cet identifiant est vu pour ce scope. */
    public boolean isFirst(String scope, String actionId) {
        Instant now = clock.instant();
        purgeIfDue(now);
        Instant cutoff = now.minus(RETENTION);
        Key key = new Key(scope, actionId);
        boolean[] first = new boolean[1];
        seenAt.compute(key, (k, previous) -> {
            if (previous != null && previous.isAfter(cutoff)) {
                first[0] = false;
                return previous; // doublon dans la fenêtre : on ne la prolonge pas.
            }
            first[0] = true;
            return now;
        });
        return first[0];
    }

    private void purgeIfDue(Instant now) {
        Instant last = lastPurge.get();
        if (Duration.between(last, now).compareTo(PURGE_INTERVAL) < 0) return;
        if (!lastPurge.compareAndSet(last, now)) return; // un autre thread vient de purger : inutile de refaire.
        purgeRuns.incrementAndGet();
        Instant cutoff = now.minus(RETENTION);
        seenAt.values().removeIf(instant -> !instant.isAfter(cutoff));
    }

    /** Réservé aux tests : nombre de fois où le nettoyage a réellement parcouru la table. */
    int purgeRuns() {
        return purgeRuns.get();
    }
}
