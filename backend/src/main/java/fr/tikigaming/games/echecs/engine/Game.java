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
                position.castling(),
                position.enPassant(),
                resetsClock ? 0 : position.halfmoveClock() + 1,
                position.turn() == Color.BLACK ? position.fullmoveNumber() + 1 : position.fullmoveNumber());
    }
}
