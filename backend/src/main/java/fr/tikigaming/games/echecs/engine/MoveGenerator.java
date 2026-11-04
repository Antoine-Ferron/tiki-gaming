package fr.tikigaming.games.echecs.engine;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

/**
 * Calcule les cases où une pièce peut aller : déplacements de base (règles D1-D7), sans vérifier si le roi reste en
 * échec (phase 3) ni les coups spéciaux (phase 4).
 */
public final class MoveGenerator {

    private static final int BOARD_SIZE = 8;

    /** Le cavalier : 2 cases dans un sens, 1 dans l'autre. */
    private static final int[][] KNIGHT_OFFSETS = {
        {1, 2}, {2, 1}, {2, -1}, {1, -2}, {-1, -2}, {-2, -1}, {-2, 1}, {-1, 2}
    };

    /** Le roi : 1 case dans les 8 directions. */
    private static final int[][] KING_OFFSETS = {{1, 0}, {1, 1}, {0, 1}, {-1, 1}, {-1, 0}, {-1, -1}, {0, -1}, {1, -1}};

    /** La tour : en ligne droite sur sa colonne et sa rangée. */
    private static final int[][] ROOK_DIRECTIONS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

    /** Le fou : en diagonale. */
    private static final int[][] BISHOP_DIRECTIONS = {{1, 1}, {1, -1}, {-1, 1}, {-1, -1}};

    private MoveGenerator() {}

    /** Les cases où peut aller la pièce posée en {@code from} ; vide si la case est libre. */
    public static Set<Square> destinations(Position position, Square from) {
        Optional<Piece> moving = position.pieceAt(from);
        if (moving.isEmpty()) {
            return Set.of();
        }
        Piece piece = moving.get();
        if (piece.type() == PieceType.ROOK) {
            return slidingDestinations(position, from, piece.color(), ROOK_DIRECTIONS);
        }
        if (piece.type() == PieceType.BISHOP) {
            return slidingDestinations(position, from, piece.color(), BISHOP_DIRECTIONS);
        }
        int[][] offsets = piece.type() == PieceType.KING ? KING_OFFSETS : KNIGHT_OFFSETS;
        return jumpDestinations(position, from, piece.color(), offsets);
    }

    /** Pièces « glissantes » : avancent case après case dans chaque direction, jusqu'au bord. */
    private static Set<Square> slidingDestinations(Position position, Square from, Color color, int[][] directions) {
        Set<Square> destinations = new HashSet<>();
        for (int[] direction : directions) {
            int file = from.file() + direction[0];
            int rank = from.rank() + direction[1];
            while (isOnBoard(file, rank) && !isOccupiedBy(position, new Square(file, rank), color)) {
                destinations.add(new Square(file, rank));
                if (position.pieceAt(new Square(file, rank)).isPresent()) {
                    break; // pièce adverse : prise possible, mais on ne va pas plus loin
                }
                file += direction[0];
                rank += direction[1];
            }
        }
        return destinations;
    }

    /** Pièces « à sauts » (cavalier, roi) : chaque décalage donne au plus une case. */
    private static Set<Square> jumpDestinations(Position position, Square from, Color color, int[][] offsets) {
        Set<Square> destinations = new HashSet<>();
        for (int[] offset : offsets) {
            int file = from.file() + offset[0];
            int rank = from.rank() + offset[1];
            if (isOnBoard(file, rank) && !isOccupiedBy(position, new Square(file, rank), color)) {
                destinations.add(new Square(file, rank));
            }
        }
        return destinations;
    }

    private static boolean isOnBoard(int file, int rank) {
        return file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;
    }

    private static boolean isOccupiedBy(Position position, Square square, Color color) {
        return position.pieceAt(square).map(piece -> piece.color() == color).orElse(false);
    }
}
