package fr.tikigaming.realtime;

/** Payload de {@code /app/rooms/{slug}/join} et {@code /app/rooms/{slug}/leave}. */
public record JoinRoomRequest(String code) {}
