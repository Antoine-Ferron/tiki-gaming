package fr.tikigaming.games.echecs.engine;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Lecture et écriture d'une position en notation FEN (6 champs séparés par un espace) : placement, trait, droits de
 * roque, case de prise en passant, compteur de demi-coups, numéro du coup.
 */
public final class Fen {

    private static final int BOARD_SIZE = 8;

    private Fen() {}

    /** Lit une FEN ; toute FEN mal écrite ou position impossible lève {@link IllegalArgumentException}. */
    public static Position parse(String fen) {
        if (fen == null) {
            throw new IllegalArgumentException("FEN absente");
        }
        String[] fields = fen.split(" ");
        if (fields.length != 6) {
            throw new IllegalArgumentException("Une FEN a 6 champs : " + fen);
        }
        return new Position(
                parsePlacement(fields[0]),
                parseTurn(fields[1]),
                parseCastling(fields[2]),
                parseEnPassant(fields[3]),
                parseCounter(fields[4], 0),
                parseCounter(fields[5], 1));
    }

    /** Écrit une position en FEN. */
    public static String toFen(Position position) {
        return placementToFen(position)
                + (position.turn() == Color.WHITE ? " w " : " b ")
                + castlingToFen(position.castling())
                + ' '
                + position.enPassant().map(Square::toString).orElse("-")
                + ' '
                + position.halfmoveClock()
                + ' '
                + position.fullmoveNumber();
    }

    private static Map<Square, Piece> parsePlacement(String placement) {
        String[] ranks = placement.split("/");
        if (ranks.length != BOARD_SIZE) {
            throw new IllegalArgumentException("Une FEN a 8 rangées : " + placement);
        }
        Map<Square, Piece> pieces = new HashMap<>();
        for (int i = 0; i < BOARD_SIZE; i++) {
            parseRank(ranks[i], BOARD_SIZE - 1 - i, pieces); // la FEN commence par la rangée 8
        }
        return pieces;
    }

    private static void parseRank(String rankText, int rank, Map<Square, Piece> pieces) {
        int file = 0;
        for (char c : rankText.toCharArray()) {
            if (Character.isDigit(c)) {
                file += c - '0';
            } else {
                // Une pièce au-delà de la colonne h est refusée par l'invariant de Square.
                pieces.put(new Square(file, rank), Piece.fromFen(c));
                file++;
            }
        }
        if (file != BOARD_SIZE) {
            throw new IllegalArgumentException("Une rangée a 8 cases : " + rankText);
        }
    }

    private static Color parseTurn(String turn) {
        return switch (turn) {
            case "w" -> Color.WHITE;
            case "b" -> Color.BLACK;
            default -> throw new IllegalArgumentException("Trait inconnu : " + turn);
        };
    }

    private static CastlingRights parseCastling(String castling) {
        if (!castling.equals("-") && !castling.matches("K?Q?k?q?")) {
            throw new IllegalArgumentException("Droits de roque inconnus : " + castling);
        }
        return new CastlingRights(
                castling.contains("K"), castling.contains("Q"), castling.contains("k"), castling.contains("q"));
    }

    private static Optional<Square> parseEnPassant(String enPassant) {
        if (enPassant.equals("-")) {
            return Optional.empty();
        }
        Square square = Square.of(enPassant);
        if (square.rank() != 2 && square.rank() != 5) {
            throw new IllegalArgumentException("Prise en passant hors des rangées 3 et 6 : " + enPassant);
        }
        return Optional.of(square);
    }

    private static int parseCounter(String counter, int minimum) {
        int value = Integer.parseInt(counter);
        if (value < minimum) {
            throw new IllegalArgumentException("Compteur invalide : " + counter);
        }
        return value;
    }

    private static String placementToFen(Position position) {
        StringBuilder placement = new StringBuilder();
        for (int rank = BOARD_SIZE - 1; rank >= 0; rank--) {
            int empty = 0;
            for (int file = 0; file < BOARD_SIZE; file++) {
                Optional<Piece> piece = position.pieceAt(new Square(file, rank));
                if (piece.isEmpty()) {
                    empty++;
                    continue;
                }
                if (empty > 0) {
                    placement.append(empty);
                    empty = 0;
                }
                placement.append(piece.get().toFen());
            }
            if (empty > 0) {
                placement.append(empty);
            }
            if (rank > 0) {
                placement.append('/');
            }
        }
        return placement.toString();
    }

    private static String castlingToFen(CastlingRights castling) {
        String text = (castling.whiteKingside() ? "K" : "")
                + (castling.whiteQueenside() ? "Q" : "")
                + (castling.blackKingside() ? "k" : "")
                + (castling.blackQueenside() ? "q" : "");
        return text.isEmpty() ? "-" : text;
    }
}
