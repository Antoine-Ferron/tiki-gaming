package fr.tikigaming.games.bang.engine;

import java.util.List;

/** Données de mise en place à adapter aux catalogues des issues #51 à #53. */
public interface GameCatalog {
    record Roles(String sheriff, String outlaw, String renegade) {}

    record CharacterCard(String id, int health) {}

    Roles roles();

    List<CharacterCard> characters();

    /** Identifiants uniques des exemplaires physiques, y compris pour deux cartes de même type. */
    List<String> cards();
}
