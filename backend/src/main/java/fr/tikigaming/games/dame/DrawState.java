package fr.tikigaming.games.dame;

import java.util.HashMap;
import java.util.Map;

/** Historique borné, immuable : FMJD annexe 1, articles 6.1 à 6.4. Compteurs en demi-coups. */
public record DrawState(Map<String, Integer> repetitions, int quietPlies, int sixteenRemaining, int fiveRemaining) {
    public DrawState {
        repetitions = Map.copyOf(repetitions);
        if (repetitions.size() > 51
                || quietPlies < 0
                || quietPlies > 50
                || sixteenRemaining < -1
                || sixteenRemaining > 32
                || fiveRemaining < -1
                || fiveRemaining > 10
                || repetitions.entrySet().stream()
                        .anyMatch(
                                e -> !e.getKey().matches("[0wWbB]{50}[WB]") || e.getValue() < 1 || e.getValue() > 3)) {
            throw new IllegalArgumentException("Historique de nulle invalide.");
        }
    }

    public static DrawState initial(Board board, Player player) {
        return new DrawState(Map.of(key(board, player), 1), 0, limit(board, 3, 32), smallLimit(board));
    }

    DrawState after(Board before, Move move, Board after, Player next) {
        boolean irreversible = !before.pieceAt(move.from()).orElseThrow().king()
                || before.pieces().size() != after.pieces().size();
        Map<String, Integer> counts = irreversible ? new HashMap<>() : new HashMap<>(repetitions);
        counts.merge(key(after, next), 1, Integer::sum);
        return new DrawState(
                counts,
                irreversible ? 0 : quietPlies + 1,
                countdown(sixteenRemaining, limit(after, 3, 32)),
                countdown(fiveRemaining, smallLimit(after)));
    }

    boolean drawn(Board board, Player player) {
        return repetitions.getOrDefault(key(board, player), 0) >= 3
                || quietPlies >= 50
                || sixteenRemaining == 0
                || fiveRemaining == 0;
    }

    private static int countdown(int previous, int newlyApplicable) {
        return previous < 0 ? newlyApplicable : previous - 1;
    }

    private static int smallLimit(Board board) {
        return limit(board, 1, 10) == 10 || limit(board, 2, 10) == 10 ? 10 : -1;
    }

    private static int limit(Board board, int strongCount, int plies) {
        for (Player lone : Player.values()) {
            var alone = board.pieces().values().stream()
                    .filter(p -> p.owner() == lone)
                    .toList();
            var other = board.pieces().values().stream()
                    .filter(p -> p.owner() != lone)
                    .toList();
            if (alone.size() == 1
                    && alone.getFirst().king()
                    && other.size() == strongCount
                    && other.stream().anyMatch(Piece::king)) return plies;
        }
        return -1;
    }

    private static String key(Board board, Player player) {
        char[] squares = "0".repeat(51).toCharArray();
        board.pieces().forEach((position, piece) -> {
            char code = piece.owner() == Player.WHITE ? 'w' : 'b';
            squares[position.row() * 5 + position.column() / 2] = piece.king() ? Character.toUpperCase(code) : code;
        });
        squares[50] = player == Player.WHITE ? 'W' : 'B';
        return new String(squares);
    }
}
