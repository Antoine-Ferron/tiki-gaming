package fr.tikigaming.games.prismine;

/**
 * Contrat : source des graines d'étages (le hasard du jeu). Sans I/O : les tests la remplacent par un bouchon qui fige
 * les graines, et donc les cartes.
 */
public interface SeedSource {

    /** Graine non signée sur 32 bits, de 0 à 2³² − 1. */
    long nextSeed();
}
