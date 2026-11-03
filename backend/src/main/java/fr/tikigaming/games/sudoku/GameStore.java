package fr.tikigaming.games.sudoku;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
    static final int MAX_PER_OWNER = 5;

    /** Résultat d'une saisie : `correct` si la valeur est celle de la solution ; `mistakes` cumule les erreurs. */
    public record MoveResult(boolean correct, int mistakes, boolean complete) {}

    /**
     * Partie en cours : grille de départ, solution (jamais exposée), grille du joueur, erreurs comptées et chrono
     * démarré à la création. Seules les saisies correctes entrent dans la grille ; chaque saisie fausse coûte une
     * erreur, comptée ici et nulle part ailleurs.
     */
    public static final class Game {

        private final String id;
        private final String owner;
        private final Difficulty difficulty;
        private final SudokuGenerator.Puzzle grids;
        private final GameTimer timer;
        private final int[] values;
        private int mistakes;

        Game(String id, String owner, Difficulty difficulty, SudokuGenerator.Puzzle grids, GameTimer timer) {
            this.id = id;
            this.owner = owner;
            this.difficulty = difficulty;
            this.grids = grids;
            this.timer = timer;
            this.values = grids.puzzle().clone();
        }

        public String id() {
            return id;
        }

        String owner() {
            return owner;
        }

        public Difficulty difficulty() {
            return difficulty;
        }

        public int[] puzzle() {
            return grids.puzzle().clone();
        }

        /**
         * @throws SudokuBadRequestException si la case n'existe pas, est un indice de départ, ou si le chiffre
         *     n'est pas de 1 à 9
         */
        public synchronized MoveResult play(int cell, int value) {
            if (cell < 0 || cell >= SudokuSolver.CELLS) {
                throw new SudokuBadRequestException("Case inconnue : " + cell);
            }
            if (value < 1 || value > SudokuSolver.SIZE) {
                throw new SudokuBadRequestException("Chiffre de 1 à 9 uniquement");
            }
            if (grids.puzzle()[cell] != 0) {
                throw new SudokuBadRequestException("Case " + cell + " : indice de départ");
            }
            boolean correct = grids.solution()[cell] == value;
            if (correct) {
                values[cell] = value;
            } else {
                mistakes++;
            }
            return new MoveResult(correct, mistakes, isComplete());
        }

        /** Grille du joueur : indices de départ et saisies correctes. */
        public synchronized int[] values() {
            return values.clone();
        }

        public synchronized int mistakes() {
            return mistakes;
        }

        private boolean isComplete() {
            for (int v : values) {
                if (v == 0) return false;
            }
            return true;
        }

        public int elapsedSeconds() {
            return timer.elapsedSeconds();
        }

        boolean isExpired() {
            return timer.elapsedSeconds() > TTL_SECONDS;
        }
    }

    private final Clock clock;
    /** Ordre d'insertion : la première entrée est la partie la plus ancienne. */
    private final Map<String, Game> games = new LinkedHashMap<>();

    public GameStore(Clock clock) {
        this.clock = clock;
    }

    /**
     * Ouvre une partie : le chrono démarre maintenant. Au-delà de {@link #MAX_PER_OWNER} parties ouvertes pour le
     * même `owner` (ex. l'adresse du client), la plus ancienne de cet `owner` est retirée ; si le magasin est plein,
     * c'est la plus ancienne de toutes. Un script ne peut donc pas bloquer les autres joueurs.
     */
    public synchronized Game start(String owner, Difficulty difficulty, SudokuGenerator.Puzzle grids) {
        if (games.size() >= MAX_GAMES) games.values().removeIf(Game::isExpired);
        evictOldestOf(owner, MAX_PER_OWNER - 1);
        if (games.size() >= MAX_GAMES) games.remove(games.keySet().iterator().next());
        GameTimer timer = new GameTimer(clock);
        timer.start();
        Game game = new Game(UUID.randomUUID().toString(), owner, difficulty, grids, timer);
        games.put(game.id(), game);
        return game;
    }

    /** @throws SudokuBadRequestException si l'id est inconnu, déjà résolu, retiré ou expiré */
    public synchronized Game find(String id) {
        Game game = id == null ? null : games.get(id);
        if (game == null || game.isExpired()) {
            games.remove(id);
            throw new SudokuBadRequestException("Partie inconnue ou expirée");
        }
        return game;
    }

    /** Clôt la partie : son id ne peut plus servir. */
    public synchronized void finish(String id) {
        games.remove(id);
    }

    private void evictOldestOf(String owner, int keep) {
        List<String> ids = new ArrayList<>();
        for (Game game : games.values()) {
            if (game.owner().equals(owner)) ids.add(game.id());
        }
        for (int i = 0; i < ids.size() - keep; i++) games.remove(ids.get(i));
    }
}
