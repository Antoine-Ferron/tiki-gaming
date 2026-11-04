package fr.tikigaming.games.sudoku;

/**
 * Règles métier du score d'une grille résolue (plus haut = meilleur).
 *
 * <ol>
 *   <li><b>Base</b> : score de la difficulté.
 *   <li><b>Bonus de temps à paliers progressifs</b> : les secondes gagnées sous le temps de référence rapportent
 *       1 point/s sur les 120 premières, 2 points/s sur les 120 suivantes, 3 points/s au-delà. Chaque palier ne
 *       s'applique qu'à sa tranche, comme un barème d'impôt.
 *   <li><b>Seuil d'activation</b> : ce bonus n'existe que si au moins 60 s ont été gagnées ; en dessous, il vaut 0.
 *   <li><b>Bonus d'invariant « sans faute »</b> : si aucune erreur n'a été commise pendant toute la partie,
 *       +10 % de (base + bonus de temps).
 *   <li><b>Pénalité</b> : 50 points par erreur.
 * </ol>
 *
 * Invariants : le total reste dans [{@value #MIN_SCORE}, {@link #maxScore(Difficulty)}] pour toute entrée valide ;
 * {@code compute} est pure (même entrées, même résultat, aucun état ni aléa) ; des entrées négatives sont refusées.
 */
public final class ScoreCalculator {

    static final int MIN_SCORE = 10;
    static final int MISTAKE_PENALTY = 50;
    static final int TIME_BONUS_ACTIVATION_SECONDS = 60;
    static final int PERFECT_BONUS_PERCENT = 10;

    /** Largeur d'une tranche de temps gagné, en secondes. */
    static final int TIER_WIDTH_SECONDS = 120;

    /** Points par seconde gagnée, tranche après tranche ; la dernière valeur vaut pour tout le reste. */
    static final int[] TIER_RATES = {1, 2, 3};

    private ScoreCalculator() {}

    /**
     * @throws IllegalArgumentException si `seconds` ou `mistakes` est négatif
     */
    public static ScoreBreakdown compute(Difficulty difficulty, int seconds, int mistakes) {
        if (seconds < 0 || mistakes < 0) {
            throw new IllegalArgumentException("Temps et erreurs doivent être positifs");
        }
        int base = difficulty.baseScore();
        int timeBonus = timeBonus(difficulty.timeBudgetSeconds() - seconds);
        int perfectBonus = mistakes == 0 ? (base + timeBonus) * PERFECT_BONUS_PERCENT / 100 : 0;
        // long : un nombre d'erreurs énorme ne doit pas déborder
        long penalty = (long) mistakes * MISTAKE_PENALTY;
        long raw = (long) base + timeBonus + perfectBonus - penalty;
        int total = (int) Math.max(MIN_SCORE, Math.min(raw, maxScore(difficulty)));
        return new ScoreBreakdown(base, timeBonus, perfectBonus, (int) Math.min(penalty, Integer.MAX_VALUE), total);
    }

    /** Plafond : partie parfaite en 0 s. Aucun score ne peut le dépasser. */
    public static int maxScore(Difficulty difficulty) {
        int base = difficulty.baseScore();
        int timeBonus = timeBonus(difficulty.timeBudgetSeconds());
        return base + timeBonus + (base + timeBonus) * PERFECT_BONUS_PERCENT / 100;
    }

    /** Bonus pour `savedSeconds` secondes gagnées (négatif ou sous le seuil d'activation : 0). */
    static int timeBonus(int savedSeconds) {
        if (savedSeconds < TIME_BONUS_ACTIVATION_SECONDS) {
            return 0;
        }
        int bonus = 0;
        int remaining = savedSeconds;
        for (int tier = 0; tier < TIER_RATES.length && remaining > 0; tier++) {
            boolean lastTier = tier == TIER_RATES.length - 1;
            int inTier = lastTier ? remaining : Math.min(remaining, TIER_WIDTH_SECONDS);
            bonus += inTier * TIER_RATES[tier];
            remaining -= inTier;
        }
        return bonus;
    }
}
