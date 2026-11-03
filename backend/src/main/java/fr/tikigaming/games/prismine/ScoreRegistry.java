package fr.tikigaming.games.prismine;

import java.util.Map;

/** Contrat : registre des scores classés (table scores de la plateforme en production). */
public interface ScoreRegistry {

    void record(String userId, long score, Map<String, Object> metadata);
}
