package fr.tikigaming.games.echecs.api;

/** Résultat d'un coup : la nouvelle position (FEN) et l'état de la partie (voir {@code GameStatus}). */
public record MoveResult(String fen, String status) {}
