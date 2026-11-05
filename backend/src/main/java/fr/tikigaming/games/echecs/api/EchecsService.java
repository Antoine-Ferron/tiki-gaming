package fr.tikigaming.games.echecs.api;

import fr.tikigaming.games.echecs.engine.Fen;
import fr.tikigaming.games.echecs.engine.Game;
import fr.tikigaming.games.echecs.engine.PieceType;
import fr.tikigaming.games.echecs.engine.Position;
import fr.tikigaming.games.echecs.engine.Square;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Relie l'API au moteur : reçoit du texte (FEN, cases en notation algébrique), appelle le moteur et renvoie du texte.
 * Aucune règle d'échecs ici : elles sont toutes dans {@code games.echecs.engine}.
 */
@Service
public class EchecsService {

    /** Les cases où peut aller la pièce posée en {@code from}, triées (réponse stable pour l'API). */
    public List<String> destinations(String fen, String from) {
        Position position = position(fen);
        return Game.legalDestinations(position, square(from)).stream()
                .map(Square::toString)
                .sorted()
                .toList();
    }

    /**
     * Joue le coup {@code from} → {@code to} (avec la promotion choisie : {@code q}, {@code r}, {@code b} ou
     * {@code n}, sinon {@code null}) et renvoie la position suivante et l'état de la partie.
     */
    public MoveResult play(String fen, String from, String to, String promotion) {
        Position position = position(fen);
        Square fromSquare = square(from);
        Square toSquare = square(to);
        Optional<PieceType> promoted = promotion(promotion);
        Position after;
        try {
            after = Game.play(position, fromSquare, toSquare, promoted);
        } catch (IllegalArgumentException e) {
            throw new EchecsRejectedException(e.getMessage());
        }
        return new MoveResult(Fen.toFen(after), Game.status(after).name());
    }

    private static Optional<PieceType> promotion(String letter) {
        if (letter == null) {
            return Optional.empty();
        }
        return switch (letter) {
            case "q" -> Optional.of(PieceType.QUEEN);
            case "r" -> Optional.of(PieceType.ROOK);
            case "b" -> Optional.of(PieceType.BISHOP);
            case "n" -> Optional.of(PieceType.KNIGHT);
            default -> throw new EchecsInvalidInputException("Promotion inconnue : " + letter + " (q, r, b ou n)");
        };
    }

    private static Position position(String fen) {
        try {
            return Fen.parse(fen);
        } catch (IllegalArgumentException e) {
            throw new EchecsInvalidInputException(e.getMessage());
        }
    }

    private static Square square(String notation) {
        try {
            return Square.of(notation);
        } catch (IllegalArgumentException e) {
            throw new EchecsInvalidInputException(e.getMessage());
        }
    }
}
