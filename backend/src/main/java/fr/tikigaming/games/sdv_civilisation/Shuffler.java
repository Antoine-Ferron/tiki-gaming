package fr.tikigaming.games.sdv_civilisation;

import java.util.List;

/** Contrat sans I/O : mélange les paquets (aléatoire en production, ordre fixe dans les tests). */
public interface Shuffler {

    /** Renvoie une copie mélangée, sans modifier la liste reçue. */
    <T> List<T> shuffle(List<T> items);
}
