package fr.tikigaming.sudoku;

import java.util.Locale;

/** Niveaux de difficulté : nombre d'indices laissés dans la grille et score de base. */
public enum Difficulty {
    EASY(40, 1000),
    MEDIUM(32, 2000),
    HARD(26, 3000);

    private final int clues;
    private final int baseScore;

    Difficulty(int clues, int baseScore) {
        this.clues = clues;
        this.baseScore = baseScore;
    }

    public int clues() {
        return clues;
    }

    public int baseScore() {
        return baseScore;
    }

    /** Accepte la valeur en minuscules ("easy") telle qu'envoyée par le front. */
    public static Difficulty parse(String value) {
        if (value == null) throw new IllegalArgumentException("Difficulté manquante");
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Difficulté inconnue : " + value);
        }
    }
}
