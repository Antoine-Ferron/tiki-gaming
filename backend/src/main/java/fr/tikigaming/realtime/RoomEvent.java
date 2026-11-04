package fr.tikigaming.realtime;

import java.time.Instant;

/**
 * Enveloppe commune des évènements diffusés sur {@code /topic/rooms/{slug}/{code}}. Le socle fournit
 * {@code ROOM_UPDATED} et {@code PLAYER_LEFT} ; un jeu ajoute ses propres {@code type} sur la même enveloppe.
 */
public record RoomEvent<T>(String type, T payload, String code, Instant serverTime) {}
