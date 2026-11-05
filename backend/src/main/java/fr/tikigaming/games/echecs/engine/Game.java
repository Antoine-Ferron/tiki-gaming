package fr.tikigaming.games.echecs.engine;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Joue un coup sur une position et renvoie la position suivante (les positions sont immuables). */
public final class Game {

    private Game() {}

    /** Joue un coup sans promotion (voir {@link #play(Position, Square, Square, Optional)}). */
    public static Position play(Position position, Square from, Square to) {
        return play(position, from, to, Optional.empty());
    }

    /**
     * Joue le coup {@code from} → {@code to}. Refuse ({@link IllegalArgumentException}) : une partie terminée (F8), une
     * case de départ vide, une pièce qui n'a pas le trait, une case inaccessible, un coup qui laisse son roi en échec
     * (L2), une promotion absente ou invalide (S6).
     */
    public static Position play(Position position, Square from, Square to, Optional<PieceType> promotion) {
        if (status(position).isOver()) {
            throw new IllegalArgumentException("La partie est terminée : " + status(position));
        }
        Piece moving = checkedMovingPiece(position, from, to);
        if (!legalDestinations(position, from).contains(to)) {
            throw new IllegalArgumentException(
                    "Coup interdit : il laisserait son roi en échec (" + from + " → " + to + ")");
        }
        boolean promotes = moving.type() == PieceType.PAWN && (to.rank() == 0 || to.rank() == 7);
        if (promotes && promotion.isEmpty()) {
            throw new IllegalArgumentException("Promotion obligatoire : choisir dame, tour, fou ou cavalier");
        }
        if (promotion.isPresent() && !promotes) {
            throw new IllegalArgumentException("Promotion impossible : seul un pion qui atteint la dernière rangée");
        }
        if (promotion.isPresent() && (promotion.get() == PieceType.KING || promotion.get() == PieceType.PAWN)) {
            throw new IllegalArgumentException(
                    "Promotion en dame, tour, fou ou cavalier seulement : " + promotion.get());
        }
        return apply(position, from, to, promotion.map(type -> new Piece(moving.color(), type)));
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
    private static Position apply(Position position, Square from, Square to, Optional<Piece> promoted) {
        Piece moving = position.pieceAt(from).orElseThrow();
        Map<Square, Piece> pieces = new HashMap<>(position.pieces());
        pieces.remove(from);
        Piece captured = pieces.put(to, promoted.orElse(moving));
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

    /** L'état de la partie pour le camp qui a le trait (F1 mat, F2 pat, F3 matériel insuffisant, F5 50 coups). */
    public static GameStatus status(Position position) {
        boolean inCheck = isInCheck(position, position.turn());
        if (!hasLegalMove(position)) {
            return inCheck ? GameStatus.CHECKMATE : GameStatus.STALEMATE;
        }
        if (isInsufficientMaterial(position)) {
            return GameStatus.DRAW_INSUFFICIENT_MATERIAL;
        }
        if (position.halfmoveClock() >= 100) {
            return GameStatus.DRAW_FIFTY_MOVES;
        }
        return inCheck ? GameStatus.CHECK : GameStatus.ONGOING;
    }

    private static boolean hasLegalMove(Position position) {
        return position.pieces().entrySet().stream()
                .filter(e -> e.getValue().color() == position.turn())
                .anyMatch(e -> !legalDestinations(position, e.getKey()).isEmpty());
    }

    /**
     * Règle F3 : aucun mat possible. Roi contre roi, roi et une pièce légère (fou ou cavalier) contre roi, ou un fou
     * de chaque côté sur des cases de même couleur.
     */
    private static boolean isInsufficientMaterial(Position position) {
        List<Map.Entry<Square, Piece>> others = position.pieces().entrySet().stream()
                .filter(e -> e.getValue().type() != PieceType.KING)
                .toList();
        if (others.isEmpty()) {
            return true;
        }
        if (others.size() == 1) {
            PieceType type = others.get(0).getValue().type();
            return type == PieceType.BISHOP || type == PieceType.KNIGHT;
        }
        if (others.size() == 2
                && others.stream().allMatch(e -> e.getValue().type() == PieceType.BISHOP)
                && others.get(0).getValue().color() != others.get(1).getValue().color()) {
            Square first = others.get(0).getKey();
            Square second = others.get(1).getKey();
            return (first.file() + first.rank()) % 2 == (second.file() + second.rank()) % 2;
        }
        return false;
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
