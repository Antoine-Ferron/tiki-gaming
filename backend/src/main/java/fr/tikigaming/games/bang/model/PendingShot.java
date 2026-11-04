package fr.tikigaming.games.bang.model;

/** Informations publiques permettant à la cible de répondre à ce tir précis. */
public record PendingShot(String id, int shooterSeat, int targetSeat) {}
