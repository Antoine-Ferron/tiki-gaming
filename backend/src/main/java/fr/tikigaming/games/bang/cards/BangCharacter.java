package fr.tikigaming.games.bang.cards;

import java.util.EnumSet;
import java.util.Set;

/** Les cartes Personnage du jeu de base : nom, points de vie de départ et pouvoir. */
public enum BangCharacter {
    BART_CASSIDY("Bart Cassidy", 4, "Chaque fois qu'il perd un point de vie, il pioche une carte."),
    CALAMITY_JANET(
            "Calamity Janet",
            4,
            "Elle peut jouer un BANG ! comme un Raté ! et inversement. Un Raté ! joué pour tirer compte comme son BANG ! du tour."),
    PAUL_REGRET(
            "Paul Regret",
            3,
            "Les autres joueurs le voient à une distance augmentée de 1. Sa distance vers eux reste normale."),
    WILLY_THE_KID("Willy le Kid", 4, "Il peut jouer autant de BANG ! qu'il veut pendant son tour.");

    /** Les seules cartes que Calamity Janet peut échanger entre elles. */
    private static final Set<CardType> JANET_SWAPS = EnumSet.of(CardType.BANG, CardType.MISSED);

    private final String label;
    private final int lifePoints;
    private final String power;

    BangCharacter(String label, int lifePoints, String power) {
        this.label = label;
        this.lifePoints = lifePoints;
        this.power = power;
    }

    public String label() {
        return label;
    }

    public int lifePoints() {
        return lifePoints;
    }

    public String power() {
        return power;
    }

    /** Nombre de cartes piochées quand le personnage perd {@code lifeLost} points de vie. */
    public int cardsDrawnOnLifeLost(int lifeLost) {
        return this == BART_CASSIDY ? lifeLost : 0;
    }

    /** Peut-on jouer la carte {@code held} à la place de {@code needed} ? */
    public boolean canUseAs(CardType held, CardType needed) {
        return held == needed || (this == CALAMITY_JANET && JANET_SWAPS.contains(held) && JANET_SWAPS.contains(needed));
    }

    /** Distance à laquelle les adversaires voient ce personnage, à partir de la distance normale. */
    public int distanceAsTarget(int distance) {
        return this == PAUL_REGRET ? distance + 1 : distance;
    }

    public int maxBangsPerTurn() {
        return this == WILLY_THE_KID ? Integer.MAX_VALUE : 1;
    }
}
