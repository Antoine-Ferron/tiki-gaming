package fr.tikigaming.games.dame;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Plateau de dames internationales de dix lignes et dix colonnes, initialement vide.
 * Une case est jouable lorsque la somme de ses coordonnées est impaire.
 * Les coordonnées sont validées par Position et les pièces occupent uniquement des cases jouables.
 */
public class Board {

    private final Map<Position, Piece> pieces;

    public Board() {
        this(Map.of());
    }

    /** Copie une position et vérifie que chaque pièce se trouve sur une case jouable. */
    public Board(Map<Position, Piece> pieces) {
        this.pieces = Map.copyOf(pieces);
        for (Position position : this.pieces.keySet()) {
            if (!isPlayable(position)) {
                throw new IllegalArgumentException("Une pièce doit se trouver sur une case jouable.");
            }
        }
    }

    /** Place vingt pions noirs et vingt pions blancs sur les quatre rangées de chaque camp. */
    public static Board initial() {
        Map<Position, Piece> pieces = new HashMap<>();
        for (int row = 0; row < 10; row++) {
            if (row == 4 || row == 5) {
                continue;
            }
            Player owner = row < 4 ? Player.BLACK : Player.WHITE;
            for (int column = 0; column < 10; column++) {
                Position position = new Position(row, column);
                if (isPlayable(position)) {
                    pieces.put(position, new Piece(owner, false));
                }
            }
        }
        return new Board(pieces);
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
        return isPlayable(new Position(row, column));
    }

    private static boolean isPlayable(Position position) {
        return (position.row() + position.column()) % 2 == 1;
    }
}
