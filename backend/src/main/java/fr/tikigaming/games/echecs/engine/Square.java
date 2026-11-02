package fr.tikigaming.games.echecs.engine;

public record Square(int file, int rank) {

    public static Square of(String notation) {
        return new Square(0, 0);
    }
}
