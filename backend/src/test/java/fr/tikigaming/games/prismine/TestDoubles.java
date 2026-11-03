package fr.tikigaming.games.prismine;

import fr.tikigaming.games.GameException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Doublures des contrats de Prismine, partagées par les tests du service et du contrôleur. Vocabulaire (voir
 * frontend/src/games/prismine/TESTS.md) :
 *
 * <ul>
 *   <li>bouchon (stub) : réponse préparée, sans logique ({@link StubSeedSource}) ;
 *   <li>faux (fake) : implémentation simplifiée mais qui fonctionne, en mémoire ({@link InMemoryRunRepository},
 *       {@link InMemoryScoreRegistry}, {@link MutableClock}) ;
 *   <li>simulacre (mock) : créé avec Mockito dans le test, on vérifie ses appels ({@code mock(AuditNotifier.class)}).
 * </ul>
 */
final class TestDoubles {

    private TestDoubles() {}

    /** Bouchon : rend les graines prévues dans l'ordre, puis répète la dernière. Fige le hasard. */
    static final class StubSeedSource implements SeedSource {
        private final Deque<Long> seeds = new ArrayDeque<>();
        private long last;

        StubSeedSource(long... seeds) {
            for (long seed : seeds) this.seeds.add(seed);
            this.last = seeds.length == 0 ? 0 : seeds[seeds.length - 1];
        }

        @Override
        public long nextSeed() {
            Long next = seeds.poll();
            return next == null ? last : next;
        }
    }

    /**
     * Faux registre des expéditions en cours, en mémoire à la place de la table Supabase, avec les mêmes règles :
     * mise à jour refusée sur une version périmée, date de dernière écriture lue sur l'horloge du test.
     */
    static final class InMemoryRunRepository implements RunRepository {
        private record Row(Run run, Instant updatedAt) {}

        private final Map<UUID, Row> rows = new ConcurrentHashMap<>();
        private final Clock clock;

        InMemoryRunRepository(Clock clock) {
            this.clock = clock;
        }

        @Override
        public void insert(Run run) {
            rows.put(run.id(), new Row(run, clock.instant()));
        }

        @Override
        public void update(Run run) {
            Row stored = rows.get(run.id());
            if (stored == null || stored.run().version() != run.version() - 1) {
                throw new GameException(409, CONFLICT);
            }
            rows.put(run.id(), new Row(run, clock.instant()));
        }

        @Override
        public Optional<Run> find(UUID id) {
            return Optional.ofNullable(rows.get(id)).map(Row::run);
        }

        @Override
        public void delete(UUID id) {
            rows.remove(id);
        }

        @Override
        public void deleteByUser(String userId) {
            rows.values().removeIf(row -> userId.equals(row.run().userId()));
        }

        @Override
        public void deleteInactiveSince(Instant cutoff) {
            rows.values().removeIf(row -> row.updatedAt().isBefore(cutoff));
        }
    }

    /** Faux registre des scores : garde les scores enregistrés pour que le test les relise. */
    static final class InMemoryScoreRegistry implements ScoreRegistry {
        record Recorded(String userId, long score, Map<String, Object> metadata) {}

        private final List<Recorded> recorded = new ArrayList<>();

        @Override
        public void record(String userId, long score, Map<String, Object> metadata) {
            recorded.add(new Recorded(userId, score, metadata));
        }

        List<Recorded> recorded() {
            return recorded;
        }
    }

    /** Horloge déterministe : le test fait avancer le temps, sans {@code Thread.sleep}. */
    static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
