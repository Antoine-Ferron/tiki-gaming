package fr.tikigaming.games.mastermind;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.random.RandomGenerator;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class MastermindService {
    static final int MAX_ACTIVE_GAMES = 1_000;
    static final long INACTIVITY_TIMEOUT_MILLIS = 60 * 60 * 1_000;

    private final Map<UUID, StoredGame> games = new ConcurrentHashMap<>();
    private final RandomGenerator random = RandomGenerator.getDefault();

    public synchronized MastermindGameSnapshot create() {
        purgeExpired();
        if (games.size() >= MAX_ACTIVE_GAMES) {
            throw new MastermindCapacityException("Trop de parties sont actuellement actives. Réessaie plus tard.");
        }
        UUID id = UUID.randomUUID();
        MastermindGame game = new MastermindGame(id, generateSecret());
        games.put(id, new StoredGame(game));
        return game.snapshot();
    }

    public MastermindGameSnapshot get(UUID id) {
        return find(id).game().snapshot();
    }

    public MastermindGameSnapshot guess(UUID id, List<MastermindColor> colors) {
        return find(id).game().guess(colors);
    }

    public MastermindGameSnapshot restart(UUID id) {
        MastermindGame game = find(id).game();
        game.restart(generateSecret());
        return game.snapshot();
    }

    @Scheduled(fixedDelayString = "${mastermind.cleanup-interval-ms:900000}")
    void purgeExpired() {
        long cutoff = System.currentTimeMillis() - INACTIVITY_TIMEOUT_MILLIS;
        games.entrySet().removeIf(entry -> entry.getValue().lastAccessMillis() < cutoff);
    }

    private StoredGame find(UUID id) {
        StoredGame stored = games.get(id);
        if (stored == null) throw new MastermindNotFoundException("Partie introuvable.");
        stored.touch();
        return stored;
    }

    private List<MastermindColor> generateSecret() {
        return random.ints(MastermindGame.CODE_LENGTH, 0, MastermindColor.values().length)
                .mapToObj(index -> MastermindColor.values()[index])
                .toList();
    }

    private static final class StoredGame {
        private final MastermindGame game;
        private volatile long lastAccessMillis = System.currentTimeMillis();

        private StoredGame(MastermindGame game) {
            this.game = game;
        }

        private MastermindGame game() {
            return game;
        }

        private long lastAccessMillis() {
            return lastAccessMillis;
        }

        private void touch() {
            lastAccessMillis = System.currentTimeMillis();
        }
    }
}
