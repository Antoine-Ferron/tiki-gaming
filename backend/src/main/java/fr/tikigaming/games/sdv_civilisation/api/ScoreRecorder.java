package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.games.sdv_civilisation.ScoreBreakdown;

/** Contrat : enregistre le score final d'un joueur connecté (le classement de la plateforme le lit ensuite). */
public interface ScoreRecorder {

    void record(String userId, ScoreBreakdown score);
}
