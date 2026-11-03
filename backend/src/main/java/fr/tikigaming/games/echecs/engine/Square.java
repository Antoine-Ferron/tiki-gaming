package fr.tikigaming.games.echecs.engine;

/** Une case de l'échiquier : colonne {@code a}-{@code h} → 0-7, rangée {@code 1}-{@code 8} → 0-7. */
public record Square(int file, int rank) {

    private static final char FIRST_FILE = 'a';
    private static final char FIRST_RANK = '1';
    private static final int BOARD_SIZE = 8;

    /** Invariant : une case est toujours sur l'échiquier. */
    public Square {
        if (file < 0 || file >= BOARD_SIZE || rank < 0 || rank >= BOARD_SIZE) {
            throw new IllegalArgumentException("Case hors de l'échiquier : colonne " + file + ", rangée " + rank);
        }
    }

    /** Lit une case en notation algébrique ({@code "e4"}). */
    public static Square of(String notation) {
        if (notation == null || notation.length() != 2) {
            throw new IllegalArgumentException("Notation de case invalide : " + notation);
        }
        return new Square(notation.charAt(0) - FIRST_FILE, notation.charAt(1) - FIRST_RANK);
    }

    /** Écrit la case en notation algébrique ({@code "e4"}). */
    @Override
    public String toString() {
        return "" + (char) (FIRST_FILE + file) + (char) (FIRST_RANK + rank);
    }
}
