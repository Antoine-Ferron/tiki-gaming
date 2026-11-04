package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.games.sdv_civilisation.ScoreBreakdown;

/** Dummy : remplit le paramètre pour une partie d'invité, qui n'enregistre jamais de score. Échoue si appelé. */
class DummyScoreRecorder implements ScoreRecorder {

    @Override
    public void record(String userId, ScoreBreakdown score) {
        throw new AssertionError("Dummy : un invité n'enregistre pas de score");
    }
}
