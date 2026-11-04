package fr.tikigaming.games.rush_hour;

/** Résultat vérifié par le serveur : score calculé, coups joués (regroupés comme le front) et minimum du niveau. */
public record LevelResult(int score, int moves, int optimal) {}
