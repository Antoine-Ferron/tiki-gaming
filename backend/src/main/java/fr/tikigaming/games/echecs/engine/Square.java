package fr.tikigaming.games.echecs.engine;

public record Square(int file, int rank) {

    private static final char FIRST_FILE = 'a';
    private static final char FIRST_RANK = '1';
    private static final int BOARD_SIZE = 8;

    public Square {
        if (file < 0 || file >= BOARD_SIZE || rank < 0 || rank >= BOARD_SIZE) {
            throw new IllegalArgumentException("Case hors de l'échiquier : colonne " + file + ", rangée " + rank);
        }
    }

    public static Square of(String notation) {
        if (notation == null || notation.length() != 2) {
            throw new IllegalArgumentException("Notation de case invalide : " + notation);
        }
        int file = notation.charAt(0) - FIRST_FILE;
        int rank = notation.charAt(1) - FIRST_RANK;
        if (file < 0 || file >= BOARD_SIZE || rank < 0 || rank >= BOARD_SIZE) {
            throw new IllegalArgumentException("Case hors de l'échiquier : " + notation);
        }
        return new Square(file, rank);
    }
}
