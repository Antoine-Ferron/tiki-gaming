package fr.tikigaming.games.dame;

/**
 * Plateau de dames internationales de dix lignes et dix colonnes, initialement vide.
 * Les cases jouables et la validation des coordonnées seront introduites par les prochains tests.
 */
public class Board {

    public int rowCount() {
        return 10;
    }

    public int columnCount() {
        return 10;
    }

    public boolean isEmpty(int row, int column) {
        return true;
    }
}
