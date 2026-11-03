package fr.tikigaming.games.echecs.engine;

import java.util.Map;
import java.util.Optional;

/** Une position d'échecs, immuable. */
public record Position(
        Map<Square, Piece> pieces,
        Color turn,
        CastlingRights castling,
        Optional<Square> enPassant,
        int halfmoveClock,
        int fullmoveNumber) {

    /** Invariants : un roi par camp, aucun pion sur la rangée 1 ni sur la rangée 8. */
    public Position {
        pieces = Map.copyOf(pieces);
        for (Color color : Color.values()) {
            Piece king = new Piece(color, PieceType.KING);
            long kings = pieces.values().stream().filter(king::equals).count();
            if (kings != 1) {
                throw new IllegalArgumentException("Il faut exactement un roi " + color + " (trouvé : " + kings + ")");
            }
        }
        pieces.forEach((square, piece) -> {
            if (piece.type() == PieceType.PAWN && (square.rank() == 0 || square.rank() == 7)) {
                throw new IllegalArgumentException("Un pion ne peut pas être en rangée 1 ou 8 : " + square);
            }
        });
    }

    /** La pièce posée sur la case, ou vide si la case est libre. */
    public Optional<Piece> pieceAt(Square square) {
        return Optional.ofNullable(pieces.get(square));
    }
}
