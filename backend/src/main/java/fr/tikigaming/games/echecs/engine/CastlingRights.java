package fr.tikigaming.games.echecs.engine;

/** Les quatre droits de roque : petit et grand roque, pour chaque camp. */
public record CastlingRights(
        boolean whiteKingside, boolean whiteQueenside, boolean blackKingside, boolean blackQueenside) {}
