package fr.tikigaming.games.rush_hour;

import java.util.List;
import org.springframework.stereotype.Service;

/** Le serveur fait autorité : il rejoue la partie envoyée par le front et calcule lui-même le score. */
@Service
public class LevelResultService {

    /** Vérifie une partie gagnée du niveau et renvoie son score, ou la refuse. */
    public LevelResult verify(int level, List<Move> moves, int hints) {
        List<String> map =
                Levels.map(level).orElseThrow(() -> new RushHourNotFoundException("Niveau inconnu : " + level));
        int optimal = Solver.minimumMoves(Board.parse(map)).orElseThrow();
        try {
            int played = SolutionVerifier.replay(map, moves);
            return new LevelResult(Scoring.levelScore(played, optimal, hints), played, optimal);
        } catch (IllegalArgumentException e) {
            throw new RushHourRejectedException(e.getMessage());
        }
    }
}
