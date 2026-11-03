package fr.tikigaming.games.echecs.engine;

public record Square(int file, int rank) {

    public static Square of(String notation) {
        return new Square(notation.charAt(0) - 'a', notation.charAt(1) - '1');
    }
}
