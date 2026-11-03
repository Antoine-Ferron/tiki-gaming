package fr.tikigaming.games.sdv_civilisation;

/**
 * Contrat sans I/O : heure courante, en millisecondes. Remplace {@code new Date()} et
 * {@code System.currentTimeMillis()} dans la logique du jeu.
 */
public interface Clock {

    long now();
}
