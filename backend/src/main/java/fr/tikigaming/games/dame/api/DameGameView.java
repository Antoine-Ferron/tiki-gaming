package fr.tikigaming.games.dame.api;

import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameRules;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import fr.tikigaming.games.dame.matches.Match;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Vue immuable construite par le serveur ; aucun plateau reçu du navigateur. */
public record DameGameView(
        UUID id,
        String whiteName,
        String blackName,
        int version,
        BoardView board,
        Player currentPlayer,
        GameStatus status,
        Player winner,
        List<MoveView> legalMoves,
        String startedAt,
        String finishedAt) {

    public DameGameView {
        legalMoves = List.copyOf(legalMoves);
    }

    public record PieceView(int row, int column, Player owner, boolean king) {}

    public record BoardView(int rows, int columns, List<PieceView> pieces) {
        public BoardView {
            pieces = List.copyOf(pieces);
        }
    }

    public record MoveView(Position from, List<Position> landings) {
        public MoveView {
            landings = List.copyOf(landings);
        }
    }

    static DameGameView of(Match match, Game game, int version) {
        List<PieceView> pieces = game.board().pieces().entrySet().stream()
                .map(e -> new PieceView(
                        e.getKey().row(),
                        e.getKey().column(),
                        e.getValue().owner(),
                        e.getValue().king()))
                .sorted(Comparator.comparingInt(PieceView::row).thenComparingInt(PieceView::column))
                .toList();
        List<MoveView> moves = new GameRules()
                .legalMoves(game.board(), game.currentPlayer()).stream()
                        .map(move -> new MoveView(move.from(), move.landings()))
                        .toList();
        return new DameGameView(
                match.id(),
                match.whiteName(),
                match.blackName(),
                version,
                new BoardView(10, 10, pieces),
                game.currentPlayer(),
                game.status(),
                match.winner().orElse(null),
                match.status() == GameStatus.IN_PROGRESS ? moves : List.of(),
                match.startedAt().toString(),
                match.finishedAt() == null ? null : match.finishedAt().toString());
    }

    Game game() {
        Map<Position, Piece> pieces = new LinkedHashMap<>();
        for (PieceView piece : board.pieces()) {
            Position position = new Position(piece.row(), piece.column());
            if (pieces.put(position, new Piece(piece.owner(), piece.king())) != null) {
                throw new IllegalArgumentException("Position de session invalide.");
            }
        }
        return new Game(new Board(pieces), currentPlayer);
    }
}
