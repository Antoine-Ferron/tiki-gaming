package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.games.sdv_civilisation.GameState;

/**
 * Partie enregistrée : son numéro de version (+1 à chaque tour, contre les coups envoyés en double), l'heure limite
 * officielle du tour en cours (ms depuis l'époque Unix) et l'état complet, mains des IA comprises.
 */
public record SavedGame(int version, long deadline, GameState state) {}
