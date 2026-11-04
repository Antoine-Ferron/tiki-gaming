package fr.tikigaming.games.sdv_civilisation;

/** Ce qu'un joueur a fait au dernier tour, et les pièces gagnées ou perdues (commerce compris). */
public record TurnEvent(int player, ActionType action, Card card, int coins) {}
