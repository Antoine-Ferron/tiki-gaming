package fr.tikigaming.games.dame;

/** Coordonnées immuables d'une case d'un damier de dix lignes et dix colonnes. */
public record Position(int row, int column) {

    public Position {
        if (row < 0 || row >= 10 || column < 0 || column >= 10) {
            throw new IllegalArgumentException("Les coordonnées doivent être comprises entre 0 et 9.");
        }
    }
}
