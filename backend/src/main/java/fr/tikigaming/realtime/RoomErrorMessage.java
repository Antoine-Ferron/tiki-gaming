package fr.tikigaming.realtime;

/** Erreur envoyée en privé sur {@code /user/queue/rooms/{slug}/errors}, même forme que {@code ApiError} côté REST. */
public record RoomErrorMessage(int status, String error) {}
