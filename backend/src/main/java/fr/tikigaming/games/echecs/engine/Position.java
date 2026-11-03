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

    public Position {
        pieces = Map.copyOf(pieces);
    }

    /** La pièce posée sur la case, ou vide si la case est libre. */
    public Optional<Piece> pieceAt(Square square) {
        return Optional.ofNullable(pieces.get(square));
    }
}
