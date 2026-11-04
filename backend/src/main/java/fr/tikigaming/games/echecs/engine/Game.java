package fr.tikigaming.games.echecs.engine;

import java.util.HashMap;
import java.util.Map;

/** Joue un coup sur une position et renvoie la position suivante (les positions sont immuables). */
public final class Game {

    private Game() {}

    /** Joue le coup {@code from} → {@code to}. */
    public static Position play(Position position, Square from, Square to) {
        Map<Square, Piece> pieces = new HashMap<>(position.pieces());
        Piece moving = pieces.remove(from);
        if (moving == null) {
            throw new IllegalArgumentException("Aucune pièce à jouer : la case " + from + " est vide");
        }
        if (moving.color() != position.turn()) {
            throw new IllegalArgumentException("Ce n'est pas le trait de cette pièce : " + from);
        }
        if (!MoveGenerator.destinations(position, from).contains(to)) {
            throw new IllegalArgumentException("Case inaccessible pour la pièce en " + from + " : " + to);
        }
        Piece captured = pieces.put(to, moving);
        boolean resetsClock = moving.type() == PieceType.PAWN || captured != null;
        return new Position(
                pieces,
                position.turn() == Color.WHITE ? Color.BLACK : Color.WHITE,
                updatedCastling(position.castling(), from, to),
                position.enPassant(),
                resetsClock ? 0 : position.halfmoveClock() + 1,
                position.turn() == Color.BLACK ? position.fullmoveNumber() + 1 : position.fullmoveNumber());
    }

    /**
     * Un droit de roque se perd dès qu'un coup part de la case du roi ou de la tour concernée, ou arrive sur la case
     * de la tour (elle est alors prise).
     */
    private static CastlingRights updatedCastling(CastlingRights rights, Square from, Square to) {
        return new CastlingRights(
                rights.whiteKingside() && untouched(from, to, "e1", "h1"),
                rights.whiteQueenside() && untouched(from, to, "e1", "a1"),
                rights.blackKingside() && untouched(from, to, "e8", "h8"),
                rights.blackQueenside() && untouched(from, to, "e8", "a8"));
    }

    private static boolean untouched(Square from, Square to, String king, String rook) {
        Square kingSquare = Square.of(king);
        Square rookSquare = Square.of(rook);
        return !from.equals(kingSquare) && !from.equals(rookSquare) && !to.equals(rookSquare);
    }
}
