package fr.tikigaming.games.dame;

/** Données immuables d'une pièce ; aucun déplacement ni promotion calculé ici. */
public record Piece(Player owner, boolean king) {}
