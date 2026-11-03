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
        int halfmoveClock = Integer.parseInt(fields[4]);
        int fullmoveNumber = Integer.parseInt(fields[5]);
        return new Position(pieces, turn, castling, enPassant, halfmoveClock, fullmoveNumber);
    }

    public static String toFen(Position position) {
        StringBuilder fen = new StringBuilder();
        for (int rank = 7; rank >= 0; rank--) {
            int empty = 0;
            for (int file = 0; file < 8; file++) {
                Optional<Piece> piece = position.pieceAt(new Square(file, rank));
                if (piece.isEmpty()) {
                    empty++;
                } else {
                    if (empty > 0) {
                        fen.append(empty);
                        empty = 0;
                    }
                    fen.append(piece.get().toFen());
                }
            }
            if (empty > 0) {
                fen.append(empty);
            }
            if (rank > 0) {
                fen.append('/');
            }
        }
        fen.append(position.turn() == Color.WHITE ? " w " : " b ");
        CastlingRights c = position.castling();
        String castling = (c.whiteKingside() ? "K" : "")
                + (c.whiteQueenside() ? "Q" : "")
                + (c.blackKingside() ? "k" : "")
                + (c.blackQueenside() ? "q" : "");
        fen.append(castling.isEmpty() ? "-" : castling);
        fen.append(' ').append(position.enPassant().map(Square::toString).orElse("-"));
        fen.append(' ').append(position.halfmoveClock());
        fen.append(' ').append(position.fullmoveNumber());
        return fen.toString();
    }
}
