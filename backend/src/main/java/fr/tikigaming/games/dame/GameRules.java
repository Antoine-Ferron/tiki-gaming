package fr.tikigaming.games.dame;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Règles des dames internationales, sans dépendance technique ni mutation du plateau fourni. */
public class GameRules {

    private static final int[][] DIAGONALS = {{-1, -1}, {-1, 1}, {1, -1}, {1, 1}};

    public List<Move> legalMoves(Board board, Player player) {
        List<Capture> captures = new ArrayList<>();
        for (Map.Entry<Position, Piece> entry : board.pieces().entrySet()) {
            if (entry.getValue().owner() == player) {
                findCaptures(
                        board.pieces(),
                        entry.getKey(),
                        entry.getKey(),
                        entry.getValue(),
                        List.of(),
                        Set.of(),
                        captures);
            }
        }

        if (!captures.isEmpty()) {
            int maximum = captures.stream().mapToInt(Capture::count).max().orElseThrow();
            return captures.stream()
                    .filter(capture -> capture.count() == maximum)
                    .map(Capture::move)
                    .toList();
        }

        List<Move> moves = new ArrayList<>();
        for (Map.Entry<Position, Piece> entry : board.pieces().entrySet()) {
            if (entry.getValue().owner() == player) {
                addOrdinaryMoves(board.pieces(), entry.getKey(), entry.getValue(), moves);
            }
        }
        return List.copyOf(moves);
    }

    public GameStatus status(Board board, Player toMove) {
        if (!legalMoves(board, toMove).isEmpty()) {
            return GameStatus.IN_PROGRESS;
        }
        return toMove == Player.WHITE ? GameStatus.BLACK_WON : GameStatus.WHITE_WON;
    }

    /** Valide le parcours complet avant de construire le nouvel état. */
    Board apply(Board board, Player player, Move move) {
        if (move == null
                || move.from() == null
                || move.landings().isEmpty()
                || !legalMoves(board, player).contains(move)) {
            throw new IllegalArgumentException("Ce coup n'est pas autorisé.");
        }

        Map<Position, Piece> pieces = new HashMap<>(board.pieces());
        Piece movingPiece = pieces.get(move.from());
        Set<Position> captured = new HashSet<>();
        Position current = move.from();

        for (Position landing : move.landings()) {
            int rowStep = Integer.signum(landing.row() - current.row());
            int columnStep = Integer.signum(landing.column() - current.column());
            for (int row = current.row() + rowStep, column = current.column() + columnStep;
                    row != landing.row();
                    row += rowStep, column += columnStep) {
                Position crossed = new Position(row, column);
                if (pieces.containsKey(crossed)) {
                    captured.add(crossed);
                }
            }
            pieces.remove(current);
            pieces.put(landing, movingPiece);
            current = landing;
        }

        // Les victimes sont restées présentes et bloquantes pendant tout le parcours.
        for (Position victim : captured) {
            pieces.remove(victim);
        }
        boolean promotes = movingPiece.owner() == Player.WHITE ? current.row() == 0 : current.row() == 9;
        pieces.put(current, new Piece(movingPiece.owner(), movingPiece.king() || promotes));
        return new Board(pieces);
    }

    private static void findCaptures(
            Map<Position, Piece> pieces,
            Position origin,
            Position current,
            Piece piece,
            List<Position> landings,
            Set<Position> captured,
            List<Capture> results) {
        List<Jump> jumps = piece.king()
                ? kingJumps(pieces, current, piece.owner(), captured)
                : manJumps(pieces, current, piece.owner(), captured);

        if (jumps.isEmpty()) {
            if (!landings.isEmpty()) {
                results.add(new Capture(new Move(origin, landings), captured.size()));
            }
            return;
        }

        for (Jump jump : jumps) {
            Map<Position, Piece> nextPieces = new HashMap<>(pieces);
            nextPieces.remove(current);
            nextPieces.put(jump.landing(), piece);
            List<Position> nextLandings = new ArrayList<>(landings);
            nextLandings.add(jump.landing());
            Set<Position> nextCaptured = new HashSet<>(captured);
            nextCaptured.add(jump.victim());

            // La nature du pion reste inchangée jusqu'à la fin de la rafle.
            findCaptures(nextPieces, origin, jump.landing(), piece, nextLandings, nextCaptured, results);
        }
    }

    private static List<Jump> manJumps(
            Map<Position, Piece> pieces, Position current, Player player, Set<Position> captured) {
        List<Jump> jumps = new ArrayList<>();
        for (int[] direction : DIAGONALS) {
            int landingRow = current.row() + 2 * direction[0];
            int landingColumn = current.column() + 2 * direction[1];
            if (!inside(landingRow, landingColumn)) {
                continue;
            }

            Position victim = new Position(current.row() + direction[0], current.column() + direction[1]);
            Position landing = new Position(landingRow, landingColumn);
            Piece opponent = pieces.get(victim);
            if (opponent != null
                    && opponent.owner() != player
                    && !captured.contains(victim)
                    && !pieces.containsKey(landing)) {
                jumps.add(new Jump(landing, victim));
            }
        }
        return jumps;
    }

    private static List<Jump> kingJumps(
            Map<Position, Piece> pieces, Position current, Player player, Set<Position> captured) {
        List<Jump> jumps = new ArrayList<>();
        for (int[] direction : DIAGONALS) {
            Position victim = null;
            for (int row = current.row() + direction[0], column = current.column() + direction[1];
                    inside(row, column);
                    row += direction[0], column += direction[1]) {
                Position position = new Position(row, column);
                Piece obstacle = pieces.get(position);
                if (obstacle != null) {
                    if (victim != null || obstacle.owner() == player || captured.contains(position)) {
                        break;
                    }
                    victim = position;
                } else if (victim != null) {
                    jumps.add(new Jump(position, victim));
                }
            }
        }
        return jumps;
    }

    private static void addOrdinaryMoves(Map<Position, Piece> pieces, Position origin, Piece piece, List<Move> moves) {
        for (int[] direction : DIAGONALS) {
            int forward = piece.owner() == Player.WHITE ? -1 : 1;
            if (!piece.king() && direction[0] != forward) {
                continue;
            }
            for (int row = origin.row() + direction[0], column = origin.column() + direction[1];
                    inside(row, column);
                    row += direction[0], column += direction[1]) {
                Position landing = new Position(row, column);
                if (pieces.containsKey(landing)) {
                    break;
                }
                moves.add(new Move(origin, List.of(landing)));
                if (!piece.king()) {
                    break;
                }
            }
        }
    }

    private static boolean inside(int row, int column) {
        return row >= 0 && row < 10 && column >= 0 && column < 10;
    }

    private record Jump(Position landing, Position victim) {}

    private record Capture(Move move, int count) {}
}
