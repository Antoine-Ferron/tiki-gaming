package fr.tikigaming.games.sdv_civilisation;

/** Les trois façons de jouer une carte : construire le bâtiment, bâtir une étape de merveille, la défausser. */
public enum ActionType implements LowercaseJson {
    BUILD,
    WONDER,
    DISCARD
}
