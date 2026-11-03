package fr.tikigaming.games.echecs.engine;

import java.util.HashMap;
import java.util.Map;

/** Lecture d'une position en notation FEN. */
public final class Fen {

    private Fen() {}

    public static Position parse(String fen) {
        String placement = fen.split(" ")[0];
        String[] ranks = placement.split("/");
        Map<Square, Piece> pieces = new HashMap<>();
        for (int i = 0; i < ranks.length; i++) {
            int rank = 7 - i; // la FEN commence par la rangée 8
            int file = 0;
            for (char c : ranks[i].toCharArray()) {
                if (Character.isDigit(c)) {
                    file += c - '0';
                } else {
                    pieces.put(new Square(file, rank), Piece.fromFen(c));
                    file++;
                }
            }
        }
        return new Position(pieces);
    }
}
