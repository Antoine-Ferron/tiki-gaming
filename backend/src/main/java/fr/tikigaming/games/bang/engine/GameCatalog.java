package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.CardInstance;
import java.util.List;

/** Composition de la pioche à fournir par le catalogue #53 ; les rôles et personnages viennent de #51 et #52. */
public interface GameCatalog {
    /** Une pioche suffisante, avec un identifiant unique par exemplaire physique même pour deux cartes du même type. */
    List<CardInstance> cards();
}
