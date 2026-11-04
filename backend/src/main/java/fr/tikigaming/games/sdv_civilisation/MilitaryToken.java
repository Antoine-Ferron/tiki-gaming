package fr.tikigaming.games.sdv_civilisation;

/** Résultat d'un duel de fin d'âge contre un voisin : +1 / +3 / +5 en victoire, −1 en défaite, 0 à égalité. */
public record MilitaryToken(int age, String against, int value) {}
