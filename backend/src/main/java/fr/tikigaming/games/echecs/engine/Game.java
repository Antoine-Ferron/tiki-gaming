package fr.tikigaming.games.echecs.engine;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Joue un coup sur une position et renvoie la position suivante (les positions sont immuables). */
public final class Game {

    private Game() {}

    /**
     * Joue le coup {@code from} → {@code to}. Refuse ({@link IllegalArgumentException}) un coup depuis une case vide,
     * avec une pièce qui n'a pas le trait, ou vers une case qu'elle ne peut pas atteindre. Pas encore géré : échec au
     * roi, roque, prise en passant, promotion (phases 3 et 4).
     */
    public static Position play(Position position, Square from, Square to) {
        Piece moving = checkedMovingPiece(position, from, to);
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
