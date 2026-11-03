package fr.tikigaming.games.sdv_civilisation;

/** Signalement d'un trésor qui vient de franchir le seuil critique. */
public record TreasuryAlert(String player, int balance, int threshold) {}
