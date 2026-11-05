package fr.tikigaming.games.echecs.api;

import fr.tikigaming.games.echecs.engine.Fen;
import fr.tikigaming.games.echecs.engine.Game;
import fr.tikigaming.games.echecs.engine.Position;
import fr.tikigaming.games.echecs.engine.Square;
import java.util.List;
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

    /** Joue le coup {@code from} → {@code to} et renvoie la FEN de la position suivante. */
    public String play(String fen, String from, String to) {
        Position position = position(fen);
        Square fromSquare = square(from);
        Square toSquare = square(to);
        try {
            return Fen.toFen(Game.play(position, fromSquare, toSquare));
        } catch (IllegalArgumentException e) {
            throw new EchecsRejectedException(e.getMessage());
        }
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
