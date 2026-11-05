package fr.tikigaming.games.dame.api;

import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.matches.MatchRepository;
import fr.tikigaming.games.dame.matches.MatchService;
import jakarta.servlet.http.HttpSession;
import java.time.Clock;
import java.util.UUID;
import java.util.function.Supplier;
import tools.jackson.databind.ObjectMapper;

/** Orchestration HTTP/session autour du moteur pur et du service de rencontres. */
public final class DameApplicationService {

    static final String ATTRIBUTE = "dame.current";
    private final MatchService matches;
    private final ObjectMapper mapper;

    public DameApplicationService(MatchRepository repository, Clock clock, Supplier<UUID> ids, ObjectMapper mapper) {
        matches = new MatchService(repository, clock, ids);
        this.mapper = mapper;
    }

    public DameGameView start(HttpSession session, String whiteName, String blackName) {
        return null; // RED : création et commit de session après les tests.
    }

    public DameGameView read(HttpSession session, UUID id) {
        return null;
    }

    public DameGameView play(HttpSession session, UUID id, int version, Move move) {
        return null;
    }
}
