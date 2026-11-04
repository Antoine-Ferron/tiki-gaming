package fr.tikigaming.games.echecs.engine;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

/** Calcule les cases où une pièce peut aller (déplacements de base, sans vérifier l'échec). */
public final class MoveGenerator {

    private static final int[][] KNIGHT_OFFSETS = {
        {1, 2}, {2, 1}, {2, -1}, {1, -2}, {-1, -2}, {-2, -1}, {-2, 1}, {-1, 2}
    };

    private MoveGenerator() {}

    public static Set<Square> destinations(Position position, Square from) {
        Optional<Piece> moving = position.pieceAt(from);
        if (moving.isEmpty()) {
            return Set.of();
        }
        Color color = moving.get().color();
        Set<Square> destinations = new HashSet<>();
        for (int[] offset : KNIGHT_OFFSETS) {
            int file = from.file() + offset[0];
            int rank = from.rank() + offset[1];
            if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                Square to = new Square(file, rank);
                boolean friendly = position.pieceAt(to)
                        .map(piece -> piece.color() == color)
                        .orElse(false);
                if (!friendly) {
                    destinations.add(to);
                }
            }
        }
        return destinations;
    }
}
