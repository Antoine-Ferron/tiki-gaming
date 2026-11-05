package fr.tikigaming.games.echecs.engine;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Joue un coup sur une position et renvoie la position suivante (les positions sont immuables). */
public final class Game {

    private Game() {}

    /**
     * Joue le coup {@code from} → {@code to}. Refuse ({@link IllegalArgumentException}) un coup depuis une case vide,
     * avec une pièce qui n'a pas le trait, ou vers une case qu'elle ne peut pas atteindre. Pas encore géré : échec au
     * roi, roque, prise en passant, promotion (phases 3 et 4).
     */
    public static Position play(Position position, Square from, Square to) {
        checkedMovingPiece(position, from, to);
        if (!legalDestinations(position, from).contains(to)) {
            throw new IllegalArgumentException(
                    "Coup interdit : il laisserait son roi en échec (" + from + " → " + to + ")");
        }
        return apply(position, from, to);
    }

    /** Règle L2 : les cases où la pièce peut aller sans laisser son propre roi en échec. */
    public static Set<Square> legalDestinations(Position position, Square from) {
        Optional<Piece> moving = position.pieceAt(from);
        if (moving.isEmpty()) {
            return Set.of();
        }
        Color color = moving.get().color();
        Set<Square> legal = new HashSet<>();
        for (Square to : MoveGenerator.destinations(position, from)) {
            if (!leavesKingInCheck(position, from, to, color)) {
                legal.add(to);
            }
        }
        return legal;
    }

    private static boolean leavesKingInCheck(Position position, Square from, Square to, Color color) {
        Map<Square, Piece> pieces = new HashMap<>(position.pieces());
        Piece moving = pieces.remove(from);
        if (moving.type() == PieceType.PAWN && (to.rank() == 0 || to.rank() == 7)) {
            // simulation seulement : le type de la pièce promue ne change pas l'échec de son propre roi
            moving = new Piece(color, PieceType.QUEEN);
        }
        Piece captured = pieces.put(to, moving);
        if (captured != null && captured.type() == PieceType.KING) {
            return false; // prendre le roi adverse : impossible en partie légale, jamais proposé ensuite
        }
        Position after = new Position(
                pieces, position.turn(), position.castling(), Optional.empty(), position.halfmoveClock(), 1);
        return isInCheck(after, color);
    }

    /** Applique un coup déjà vérifié. */
    private static Position apply(Position position, Square from, Square to) {
        Piece moving = position.pieceAt(from).orElseThrow();
        Map<Square, Piece> pieces = new HashMap<>(position.pieces());
        pieces.remove(from);
        Piece captured = pieces.put(to, moving);
        boolean resetsClock = moving.type() == PieceType.PAWN || captured != null;
        boolean blackMoved = position.turn() == Color.BLACK;
        return new Position(
                pieces,
                blackMoved ? Color.WHITE : Color.BLACK,
                updatedCastling(position.castling(), from, to),
                enPassantTarget(moving, from, to),
                resetsClock ? 0 : position.halfmoveClock() + 1,
                blackMoved ? position.fullmoveNumber() + 1 : position.fullmoveNumber());
    }

    /** La pièce jouée, après avoir vérifié que le coup est permis. */
    private static Piece checkedMovingPiece(Position position, Square from, Square to) {
        Piece moving = position.pieceAt(from)
                .orElseThrow(
                        () -> new IllegalArgumentException("Aucune pièce à jouer : la case " + from + " est vide"));
        if (moving.color() != position.turn()) {
            throw new IllegalArgumentException("Ce n'est pas le trait de cette pièce : " + from);
        }
        if (!MoveGenerator.destinations(position, from).contains(to)) {
            throw new IllegalArgumentException("Case inaccessible pour la pièce en " + from + " : " + to);
        }
        return moving;
    }

    /** Après un double pas de pion, la case sautée devient la case de prise en passant ; sinon il n'y en a pas. */
    private static Optional<Square> enPassantTarget(Piece moving, Square from, Square to) {
        if (moving.type() == PieceType.PAWN && Math.abs(to.rank() - from.rank()) == 2) {
            return Optional.of(new Square(from.file(), (from.rank() + to.rank()) / 2));
        }
        return Optional.empty();
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

    /** Règle L1 : le roi du camp {@code color} est attaqué par au moins une pièce adverse. */
    public static boolean isInCheck(Position position, Color color) {
        Square king = position.pieces().entrySet().stream()
                .filter(e -> e.getValue().equals(new Piece(color, PieceType.KING)))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElseThrow();
        return isAttacked(position, king, color == Color.WHITE ? Color.BLACK : Color.WHITE);
    }

    /** La case est-elle attaquée par une pièce du camp {@code by} ? (Un pion n'attaque qu'en diagonale.) */
    static boolean isAttacked(Position position, Square square, Color by) {
        for (Map.Entry<Square, Piece> entry : position.pieces().entrySet()) {
            Piece piece = entry.getValue();
            if (piece.color() != by) {
                continue;
            }
            Square from = entry.getKey();
            boolean attacks = piece.type() == PieceType.PAWN
                    ? square.rank() - from.rank() == (by == Color.WHITE ? 1 : -1)
                            && Math.abs(square.file() - from.file()) == 1
                    : MoveGenerator.destinations(position, from).contains(square);
            if (attacks) {
                return true;
            }
        }
        return false;
    }

    private static boolean untouched(Square from, Square to, String king, String rook) {
        Square kingSquare = Square.of(king);
        Square rookSquare = Square.of(rook);
        return !from.equals(kingSquare) && !from.equals(rookSquare) && !to.equals(rookSquare);
    }
}
