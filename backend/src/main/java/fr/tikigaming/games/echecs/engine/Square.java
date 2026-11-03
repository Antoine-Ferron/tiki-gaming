package fr.tikigaming.games.echecs.engine;

public record Square(int file, int rank) {

    private static final char FIRST_FILE = 'a';
    private static final char FIRST_RANK = '1';

    public static Square of(String notation) {
        return new Square(notation.charAt(0) - FIRST_FILE, notation.charAt(1) - FIRST_RANK);
    }
}
