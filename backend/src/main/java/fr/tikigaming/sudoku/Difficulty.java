package fr.tikigaming.sudoku;

/** Niveaux de difficulté : nombre d'indices laissés dans la grille et score de base. */
public enum Difficulty {
    EASY(40, 1000, 600),
    MEDIUM(32, 2000, 900),
    HARD(26, 3000, 1200);

    private final int clues;
    private final int baseScore;
    private final int timeBudgetSeconds;

    Difficulty(int clues, int baseScore, int timeBudgetSeconds) {
        this.clues = clues;
        this.baseScore = baseScore;
        this.timeBudgetSeconds = timeBudgetSeconds;
    }

    public int clues() {
        return clues;
    }

    public int baseScore() {
        return baseScore;
    }

    /** Temps de référence : seules les secondes gagnées en dessous rapportent un bonus. */
    public int timeBudgetSeconds() {
        return timeBudgetSeconds;
    }

    /** Accepte la valeur en minuscules ("easy") telle qu'envoyée par le front. */
    public static Difficulty parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Difficulté manquante");
        }
        String name = value.trim();
        for (Difficulty difficulty : values()) {
            if (difficulty.name().equalsIgnoreCase(name)) {
                return difficulty;
            }
        }
        throw new IllegalArgumentException("Difficulté inconnue : " + value);
    }
}
