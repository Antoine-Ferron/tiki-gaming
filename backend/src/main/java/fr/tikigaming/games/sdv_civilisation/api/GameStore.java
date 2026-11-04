package fr.tikigaming.games.sdv_civilisation.api;

import java.util.Optional;

/**
 * Contrat : la partie d'un joueur, là où elle est gardée (session HTTP pour un invité, Supabase pour un compte).
 * Une seule partie par joueur.
 */
public interface GameStore {

    Optional<SavedGame> load();

    /**
     * Enregistre la partie si la version enregistrée est encore {@code expectedVersion} ; {@code 0} remplace la
     * partie existante, quelle qu'elle soit (nouvelle partie).
     *
     * @throws StaleGameException si la partie a changé entre-temps
     */
    void save(SavedGame game, int expectedVersion);

    void clear();
}
