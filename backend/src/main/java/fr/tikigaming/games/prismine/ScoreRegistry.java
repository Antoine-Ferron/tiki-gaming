package fr.tikigaming.games.prismine;

import java.util.Map;
import java.util.UUID;

/** Contrat : registre des scores classés (table scores de la plateforme en production). */
public interface ScoreRegistry {

    /**
     * Classe le score d'une expédition. Idempotent : si le score de {@code runId} est déjà enregistré (nouvelle
     * tentative après une panne), rien n'est ajouté.
     */
    void record(UUID runId, String userId, long score, Map<String, Object> metadata);
}
