package fr.tikigaming.realtime;

/**
 * Vue d'une salle diffusée à tout le monde (contrairement à {@link RoomView}, jamais de siège : un siège n'a de sens
 * que pour le compte à qui il appartient, jamais pour les autres joueurs assis).
 */
public record RoomSummary(String gameSlug, String code, int playerCount, int maxPlayers) {}
