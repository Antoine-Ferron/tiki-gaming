package fr.tikigaming.games.sudoku;

import java.time.Instant;

/**
 * Source de l'heure courante. Contrat volontairement minimal : le code métier demande l'heure à cette interface
 * au lieu de lire l'horloge système, ce qui permet de la figer dans les tests.
 */
public interface Clock {

    Instant now();
}
