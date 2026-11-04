package fr.tikigaming.games.echecs.engine;

import java.util.HashSet;
import java.util.Set;

/** Calcule les cases où une pièce peut aller (déplacements de base, sans vérifier l'échec). */
public final class MoveGenerator {

    private static final int[][] KNIGHT_OFFSETS = {
        {1, 2}, {2, 1}, {2, -1}, {1, -2}, {-1, -2}, {-2, -1}, {-2, 1}, {-1, 2}
    };

    private MoveGenerator() {}

    public static Set<Square> destinations(Position position, Square from) {
        Set<Square> destinations = new HashSet<>();
        for (int[] offset : KNIGHT_OFFSETS) {
            destinations.add(new Square(from.file() + offset[0], from.rank() + offset[1]));
        }
        return destinations;
    }
}
