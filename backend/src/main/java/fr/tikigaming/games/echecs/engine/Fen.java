package fr.tikigaming.games.echecs.engine;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Lecture d'une position en notation FEN. */
public final class Fen {

    private Fen() {}

    public static Position parse(String fen) {
        if (fen == null) {
            throw new IllegalArgumentException("FEN absente");
        }
        String[] fields = fen.split(" ");
        if (fields.length != 6) {
            throw new IllegalArgumentException("Une FEN a 6 champs : " + fen);
        }
        String[] ranks = fields[0].split("/");
        if (ranks.length != 8) {
            throw new IllegalArgumentException("Une FEN a 8 rangées : " + fields[0]);
        }
        Map<Square, Piece> pieces = new HashMap<>();
        for (int i = 0; i < ranks.length; i++) {
            int rank = 7 - i; // la FEN commence par la rangée 8
            int file = 0;
            for (char c : ranks[i].toCharArray()) {
                if (Character.isDigit(c)) {
                    file += c - '0';
                } else {
                    if (file > 7) {
                        throw new IllegalArgumentException("Rangée de plus de 8 cases : " + ranks[i]);
                    }
                    pieces.put(new Square(file, rank), Piece.fromFen(c));
                    file++;
                }
            }
            if (file != 8) {
                throw new IllegalArgumentException("Une rangée a 8 cases : " + ranks[i]);
            }
        }
        if (!fields[1].equals("w") && !fields[1].equals("b")) {
            throw new IllegalArgumentException("Trait inconnu : " + fields[1]);
        }
        Color turn = fields[1].equals("w") ? Color.WHITE : Color.BLACK;
        String c = fields[2];
        if (!c.equals("-") && !c.matches("K?Q?k?q?")) {
            throw new IllegalArgumentException("Droits de roque inconnus : " + c);
        }
        CastlingRights castling =
                new CastlingRights(c.contains("K"), c.contains("Q"), c.contains("k"), c.contains("q"));
        Optional<Square> enPassant = fields[3].equals("-") ? Optional.empty() : Optional.of(Square.of(fields[3]));
        if (enPassant.isPresent()
                && enPassant.get().rank() != 2
                && enPassant.get().rank() != 5) {
            throw new IllegalArgumentException("Prise en passant hors des rangées 3 et 6 : " + fields[3]);
        }
        int halfmoveClock = Integer.parseInt(fields[4]);
        int fullmoveNumber = Integer.parseInt(fields[5]);
        if (halfmoveClock < 0 || fullmoveNumber < 1) {
            throw new IllegalArgumentException("Compteurs invalides : " + fields[4] + " " + fields[5]);
        }
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
