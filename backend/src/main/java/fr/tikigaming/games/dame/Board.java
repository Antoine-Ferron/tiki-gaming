package fr.tikigaming.games.dame;

import java.util.Map;
import java.util.Optional;

/**
 * Plateau de dames internationales de dix lignes et dix colonnes, initialement vide.
 * Une case est jouable lorsque la somme de ses coordonnées est impaire.
 * La validation des coordonnées sera introduite par les prochains tests.
 */
public class Board {

    private final Map<Position, Piece> pieces;

    public Board() {
        this(Map.of());
    }

    /** Reconstitue uniquement les données d'une position, sans calcul des règles. */
    public Board(Map<Position, Piece> pieces) {
        this.pieces = Map.copyOf(pieces);
    }

    /** Squelette RED : le placement initial reste à implémenter. */
    public static Board initial() {
        return new Board();
    }

    public Map<Position, Piece> pieces() {
        return pieces;
    }

    public Optional<Piece> pieceAt(Position position) {
        return Optional.ofNullable(pieces.get(position));
    }

    public int rowCount() {
        return 10;
    }

    public int columnCount() {
        return 10;
    }

    public boolean isEmpty(int row, int column) {
        return pieceAt(new Position(row, column)).isEmpty();
    }

    public boolean isPlayable(int row, int column) {
        return (row + column) % 2 == 1;
    }
}
