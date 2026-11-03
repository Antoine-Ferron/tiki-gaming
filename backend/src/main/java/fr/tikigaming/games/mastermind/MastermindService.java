package fr.tikigaming.games.mastermind;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Service;

@Service
public class MastermindService {
    static final int MAX_ACTIVE_GAMES = 1_000;
    static final int MAX_GAMES_PER_CLIENT = 5;
    static final long INACTIVITY_TIMEOUT_MILLIS = 60 * 60 * 1_000;
    // Une partie sans aucun coup joué (page ouverte puis fermée) libère vite sa place.
    static final long UNPLAYED_TIMEOUT_MILLIS = 5 * 60 * 1_000;

    private final Map<UUID, StoredGame> games = new ConcurrentHashMap<>();
    private final RandomGenerator random = RandomGenerator.getDefault();
    private final Clock clock;

    public MastermindService() {
        this(Clock.systemUTC());
    }

    MastermindService(Clock clock) {
        this.clock = clock;
    }

    /** Crée une partie pour {@code client} (adresse IP) : au plus {@link #MAX_GAMES_PER_CLIENT} parties actives. */
    public synchronized MastermindGameSnapshot create(String client) {
        purgeExpired();
        if (games.size() >= MAX_ACTIVE_GAMES) {
            throw new MastermindCapacityException("Trop de parties sont actuellement actives. Réessaie plus tard.");
        }
        long ownedByClient = games.values().stream()
                .filter(stored -> stored.client().equals(client))
                .count();
        if (ownedByClient >= MAX_GAMES_PER_CLIENT) {
            throw new MastermindCapacityException(
                    "Tu as déjà trop de parties ouvertes. Termine-en une ou réessaie plus tard.");
        }
        UUID id = UUID.randomUUID();
        MastermindGame game = new MastermindGame(id, generateSecret());
        games.put(id, new StoredGame(game, client, clock.millis()));
        return game.snapshot();
    }

    public MastermindGameSnapshot get(UUID id) {
        purgeExpired();
        return find(id).game().snapshot();
    }

    public MastermindGameSnapshot guess(UUID id, List<MastermindColor> colors) {
        purgeExpired();
        StoredGame stored = find(id);
        stored.markPlayed();
        return stored.game().guess(colors);
    }

    public MastermindGameSnapshot restart(UUID id) {
        purgeExpired();
        MastermindGame game = find(id).game();
        game.restart(generateSecret());
        return game.snapshot();
    }

    int activeGames() {
        return games.size();
    }

    void purgeExpired() {
        long now = clock.millis();
        games.values().removeIf(stored -> stored.isExpired(now));
    }

    private StoredGame find(UUID id) {
        StoredGame stored = games.get(id);
        if (stored == null) throw new MastermindNotFoundException("Partie introuvable.");
        stored.touch(clock.millis());
        return stored;
    }

    private List<MastermindColor> generateSecret() {
        return random.ints(MastermindGame.CODE_LENGTH, 0, MastermindColor.values().length)
                .mapToObj(index -> MastermindColor.values()[index])
                .toList();
    }

    private static final class StoredGame {
        private final MastermindGame game;
        private final String client;
        private volatile long lastAccessMillis;
        private volatile boolean played;

        private StoredGame(MastermindGame game, String client, long now) {
            this.game = game;
            this.client = client;
            this.lastAccessMillis = now;
        }

        private MastermindGame game() {
            return game;
        }

        private String client() {
            return client;
        }

        private void touch(long now) {
            lastAccessMillis = now;
        }

        private void markPlayed() {
            played = true;
        }

        private boolean isExpired(long now) {
            long timeout = played ? INACTIVITY_TIMEOUT_MILLIS : UNPLAYED_TIMEOUT_MILLIS;
            return now - lastAccessMillis >= timeout;
        }
    }
}
