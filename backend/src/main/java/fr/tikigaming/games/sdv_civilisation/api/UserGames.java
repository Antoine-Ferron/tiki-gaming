package fr.tikigaming.games.sdv_civilisation.api;

/** Contrat : la partie d'un joueur connecté, enregistrée en base pour la reprendre plus tard, ailleurs. */
public interface UserGames {

    GameStore forUser(String userId);
}
