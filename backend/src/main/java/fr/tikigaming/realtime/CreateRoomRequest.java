package fr.tikigaming.realtime;

/** Payload de {@code /app/rooms/{slug}/create}. */
public record CreateRoomRequest(int maxPlayers) {}
