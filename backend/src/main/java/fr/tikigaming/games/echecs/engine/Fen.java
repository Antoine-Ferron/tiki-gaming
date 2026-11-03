package fr.tikigaming.games.echecs.engine;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Lecture d'une position en notation FEN. */
public final class Fen {

    private Fen() {}

    public static Position parse(String fen) {
        String[] fields = fen.split(" ");
        String placement = fields[0];
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
        Color turn = fields[1].equals("w") ? Color.WHITE : Color.BLACK;
        String c = fields[2];
        CastlingRights castling =
                new CastlingRights(c.contains("K"), c.contains("Q"), c.contains("k"), c.contains("q"));
        Optional<Square> enPassant = fields[3].equals("-") ? Optional.empty() : Optional.of(Square.of(fields[3]));
        return new Position(pieces, turn, castling, enPassant);
    }
}
