package fr.tikigaming.sudoku;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Parties en cours, gardées côté serveur : la grille, la difficulté et l'heure de début ne viennent jamais du
 * client, qui ne renvoie que l'identifiant de partie. Le temps vient de {@link Clock}.
 *
 * <p>En mémoire : une partie disparaît au redémarrage, à l'expiration ({@link #TTL_SECONDS}) et dès qu'elle est
 * résolue (un id ne rapporte qu'un score). Le nombre de parties ouvertes est plafonné ({@link #MAX_GAMES}).
 */
@Component
public class GameStore {

    static final int TTL_SECONDS = 2 * 60 * 60;
    static final int MAX_GAMES = 10_000;

    /** Partie en cours : grille de départ, solution (jamais exposée) et chronomètre démarré à la création. */
    public static final class Game {

        private final String id;
        private final Difficulty difficulty;
        private final SudokuGenerator.Puzzle grids;
        private final GameTimer timer;

        Game(String id, Difficulty difficulty, SudokuGenerator.Puzzle grids, GameTimer timer) {
            this.id = id;
            this.difficulty = difficulty;
            this.grids = grids;
            this.timer = timer;
        }

        public String id() {
            return id;
        }

        public Difficulty difficulty() {
            return difficulty;
        }

        public int[] puzzle() {
            return grids.puzzle().clone();
        }

        public int elapsedSeconds() {
            return timer.elapsedSeconds();
        }

        boolean isExpired() {
            return timer.elapsedSeconds() > TTL_SECONDS;
        }
    }

    private final Clock clock;
    private final Map<String, Game> games = new ConcurrentHashMap<>();

    public GameStore(Clock clock) {
        this.clock = clock;
    }

    /** Ouvre une partie : le chrono démarre maintenant. */
    public Game start(Difficulty difficulty, SudokuGenerator.Puzzle grids) {
        if (games.size() >= MAX_GAMES) games.values().removeIf(Game::isExpired);
        if (games.size() >= MAX_GAMES) {
            throw new IllegalStateException("Trop de parties ouvertes, réessayez plus tard");
        }
        GameTimer timer = new GameTimer(clock);
        timer.start();
        Game game = new Game(UUID.randomUUID().toString(), difficulty, grids, timer);
        games.put(game.id(), game);
        return game;
    }

    /** @throws IllegalArgumentException si l'id est inconnu, déjà résolu ou expiré */
    public Game find(String id) {
        Game game = id == null ? null : games.get(id);
        if (game == null || game.isExpired()) {
            if (game != null) games.remove(id);
            throw new IllegalArgumentException("Partie inconnue ou expirée");
        }
        return game;
    }

    /** Clôt la partie : son id ne peut plus servir. */
    public void finish(String id) {
        games.remove(id);
    }
}
