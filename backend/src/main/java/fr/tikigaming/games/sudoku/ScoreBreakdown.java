package fr.tikigaming.games.sudoku;

/** Détail d'un score : chaque règle métier y est visible séparément. */
public record ScoreBreakdown(int base, int timeBonus, int perfectBonus, int mistakePenalty, int total) {

    /** Partie non résolue : rien n'est compté. */
    public static final ScoreBreakdown NONE = new ScoreBreakdown(0, 0, 0, 0, 0);
}
