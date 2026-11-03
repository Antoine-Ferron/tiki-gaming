package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.StartingCharacter;
import java.util.List;

/** Données de mise en place à adapter aux catalogues des issues #51 à #53. */
public interface GameCatalog {
    record Roles(String sheriff, String outlaw, String renegade) {}

    /** Identifiants distincts des trois rôles utilisés à quatre joueurs. */
    Roles roles();

    /** Au moins quatre personnages aux identifiants distincts et aux PV strictement positifs. */
    List<StartingCharacter> characters();

    /** Une pioche suffisante, avec un identifiant unique par exemplaire physique même pour deux cartes du même type. */
    List<String> cards();
}
