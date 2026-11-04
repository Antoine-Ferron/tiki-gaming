package fr.tikigaming.scores;

import fr.tikigaming.auth.AuthUser;
import tools.jackson.databind.JsonNode;

/**
 * Vérification propre à un jeu, avant l'enregistrement d'un score : par exemple retrouver la partie jouée côté
 * serveur et recalculer son score. Déclarer l'implémentation comme bean Spring suffit à la brancher sur
 * {@code POST /api/scores}. Sans validateur, un jeu n'a que les règles du catalogue (jeu actif, max_score).
 */
public interface ScoreValidator {

    /** Slug du jeu vérifié (games.slug). */
    String gameSlug();

    /** Lève une {@link fr.tikigaming.config.ApiException} (message pour le joueur) si le score est refusé. */
    void validate(AuthUser player, long score, JsonNode metadata);
}
