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
        if (moving.color() != position.turn()) {
            throw new IllegalArgumentException("Ce n'est pas le trait de cette pièce : " + from);
        }
        pieces.put(to, moving);
        return new Position(
                pieces,
                position.turn() == Color.WHITE ? Color.BLACK : Color.WHITE,
                position.castling(),
                position.enPassant(),
                position.halfmoveClock(),
                position.fullmoveNumber());
    }
}
