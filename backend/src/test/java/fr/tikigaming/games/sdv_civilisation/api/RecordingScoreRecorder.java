package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.games.sdv_civilisation.ScoreBreakdown;
import java.util.ArrayList;
import java.util.List;

/** Spy (écrit à la main) : retient chaque score enregistré, pour vérifier ce qui a été envoyé et combien de fois. */
class RecordingScoreRecorder implements ScoreRecorder {

    record Recorded(String userId, ScoreBreakdown score) {}

    final List<Recorded> recorded = new ArrayList<>();

    @Override
    public void record(String userId, ScoreBreakdown score) {
        recorded.add(new Recorded(userId, score));
    }
}
