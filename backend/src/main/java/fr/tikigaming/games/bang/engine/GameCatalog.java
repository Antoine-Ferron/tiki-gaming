package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.CardInstance;
import java.util.List;

/** Composition de la pioche utilisée pour la mise en place d'une partie BANG!. */
public interface GameCatalog {
    /** Une pioche suffisante, avec un identifiant unique par exemplaire physique même pour deux cartes du même type. */
    List<CardInstance> cards();
}
