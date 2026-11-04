package fr.tikigaming.games.echecs.api;

import fr.tikigaming.games.echecs.engine.Fen;
import fr.tikigaming.games.echecs.engine.MoveGenerator;
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
        return MoveGenerator.destinations(Fen.parse(fen), Square.of(from)).stream()
                .map(Square::toString)
                .sorted()
                .toList();
    }
}
