package fr.tikigaming.games.sdv_civilisation;

/** Signalement d'un joueur qui a laissé expirer son tour ({@code deadline} : heure limite dépassée, en ms). */
public record InactivityReport(String player, long deadline) {}
