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

    /** La tour : en ligne droite sur sa colonne et sa rangée. */
    private static final int[][] ROOK_DIRECTIONS = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};

    /** Le fou : en diagonale. */
    private static final int[][] BISHOP_DIRECTIONS = {{1, 1}, {1, -1}, {-1, 1}, {-1, -1}};

    /** Le roi et la dame : les 8 directions (lignes droites + diagonales). */
    private static final int[][] ALL_DIRECTIONS = {{1, 0}, {1, 1}, {0, 1}, {-1, 1}, {-1, 0}, {-1, -1}, {0, -1}, {1, -1}
    };

    private MoveGenerator() {}

    /** Les cases où peut aller la pièce posée en {@code from} ; vide si la case est libre. */
    public static Set<Square> destinations(Position position, Square from) {
        Optional<Piece> moving = position.pieceAt(from);
        if (moving.isEmpty()) {
            return Set.of();
        }
        Piece piece = moving.get();
        return switch (piece.type()) {
            case KING -> jumpDestinations(position, from, piece.color(), ALL_DIRECTIONS);
            case ROOK -> slidingDestinations(position, from, piece.color(), ROOK_DIRECTIONS);
            case BISHOP -> slidingDestinations(position, from, piece.color(), BISHOP_DIRECTIONS);
            case QUEEN -> slidingDestinations(position, from, piece.color(), ALL_DIRECTIONS);
            case PAWN -> pawnDestinations(position, from, piece.color());
            default -> jumpDestinations(position, from, piece.color(), KNIGHT_OFFSETS);
        };
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

    /**
     * Pièces « glissantes » (tour, fou, dame) : avancent case après case dans chaque direction ; s'arrêtent avant une
     * pièce de leur camp, ou sur une pièce adverse (prise).
     */
    private static Set<Square> slidingDestinations(Position position, Square from, Color color, int[][] directions) {
        Set<Square> destinations = new HashSet<>();
        for (int[] direction : directions) {
            int file = from.file() + direction[0];
            int rank = from.rank() + direction[1];
            while (isOnBoard(file, rank) && !isOccupiedBy(position, new Square(file, rank), color)) {
                Square to = new Square(file, rank);
                destinations.add(to);
                if (position.pieceAt(to).isPresent()) {
                    break; // pièce adverse : prise possible, mais on ne va pas plus loin
                }
                file += direction[0];
                rank += direction[1];
            }
        }
        return destinations;
    }

    /**
     * Le pion : avance d'une case vers le camp adverse, ou de deux depuis sa rangée de départ ; prend en diagonale
     * vers l'avant. Les blancs montent (rangée 2 au départ), les noirs descendent (rangée 7).
     */
    private static Set<Square> pawnDestinations(Position position, Square from, Color color) {
        int forward = color == Color.WHITE ? 1 : -1;
        int startRank = color == Color.WHITE ? 1 : BOARD_SIZE - 2;
        Set<Square> destinations = new HashSet<>();
        Square oneStep = new Square(from.file(), from.rank() + forward);
        if (position.pieceAt(oneStep).isEmpty()) {
            destinations.add(oneStep);
            if (from.rank() == startRank) {
                Square twoSteps = new Square(from.file(), from.rank() + 2 * forward);
                if (position.pieceAt(twoSteps).isEmpty()) {
                    destinations.add(twoSteps);
                }
            }
        }
        for (int side : new int[] {-1, 1}) {
            int file = from.file() + side;
            if (!isOnBoard(file, from.rank() + forward)) {
                continue;
            }
            Square diagonal = new Square(file, from.rank() + forward);
            if (position.pieceAt(diagonal).isPresent() && !isOccupiedBy(position, diagonal, color)) {
                destinations.add(diagonal);
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
