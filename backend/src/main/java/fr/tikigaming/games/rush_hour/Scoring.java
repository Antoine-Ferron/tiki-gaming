package fr.tikigaming.games.rush_hour;

/** Barème d'un niveau (docs/games/rush-hour/regles.md, § 7), identique à celui du front. */
public final class Scoring {

    static final int MAX_LEVEL_SCORE = 1000;
    static final int EXTRA_MOVE_PENALTY = 50;
    static final int HINT_PENALTY = 200;

    private Scoring() {}

    /** Score d'un niveau, entre 0 et 1000. Moins de coups que le minimum ou des indices négatifs : impossible. */
    public static int levelScore(int moves, int optimal, int hints) {
        if (moves < optimal) {
            throw new IllegalArgumentException(
                    "Nombre de coups impossible : " + moves + " pour un minimum de " + optimal);
        }
        if (hints < 0) {
            throw new IllegalArgumentException("Nombre d’indices impossible : " + hints);
        }
        int penalty = EXTRA_MOVE_PENALTY * (moves - optimal) + HINT_PENALTY * hints;
        return Math.max(0, MAX_LEVEL_SCORE - penalty);
    }
}
