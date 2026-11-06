package fr.tikigaming.games.dame.api;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.dame.DrawState;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.matches.Match;
import fr.tikigaming.games.dame.matches.MatchRepository;
import fr.tikigaming.games.dame.matches.MatchService;
import jakarta.servlet.http.HttpSession;
import java.time.Clock;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Orchestration HTTP/session autour du moteur pur et du service de rencontres. */
public final class DameApplicationService {

    static final String ATTRIBUTE = "dame.current";
    static final String HISTORY = "dame.history";
    private final MatchService matches;
    private final ObjectMapper mapper;

    public DameApplicationService(MatchRepository repository, Clock clock, Supplier<UUID> ids, ObjectMapper mapper) {
        matches = new MatchService(repository, clock, ids);
        this.mapper = Objects.requireNonNull(mapper);
    }

    public DameGameView start(HttpSession session, String whiteName, String blackName) {
        synchronized (session) {
            Match match;
            try {
                match = matches.start(whiteName, blackName);
            } catch (IllegalArgumentException error) {
                throw new ApiException(HttpStatus.BAD_REQUEST, error.getMessage());
            }
            Game game = new Game();
            DameGameView view = DameGameView.of(match, game, 0);
            commit(session, view, game.drawState());
            return view;
        }
    }

    public DameGameView read(HttpSession session, UUID id) {
        if (session == null) throw notFound();
        synchronized (session) {
            return owned(session, id);
        }
    }

    public DameGameView play(HttpSession session, UUID id, int version, Move move) {
        if (session == null) throw notFound();
        synchronized (session) {
            DameGameView before = owned(session, id);
            if (before.version() != version || before.status() != GameStatus.IN_PROGRESS) {
                throw conflict();
            }
            int nextVersion;
            try {
                nextVersion = Math.addExact(version, 1);
            } catch (ArithmeticException overflow) {
                throw conflict();
            }
            // Le jeu reconstruit est une copie : un refus ou une panne ne modifie pas la session.
            Game next = before.game(history(session));
            try {
                next.play(move);
            } catch (IllegalArgumentException error) {
                throw new ApiException(HttpStatus.BAD_REQUEST, error.getMessage());
            }
            Match match = next.status() == GameStatus.IN_PROGRESS ? metadata(before) : recordResult(before.id(), next);
            DameGameView after = DameGameView.of(match, next, nextVersion);
            commit(session, after, next.drawState());
            return after;
        }
    }

    private Match recordResult(UUID id, Game game) {
        try {
            return matches.finish(id, game);
        } catch (IllegalStateException alreadyRecorded) {
            // Une réponse peut être perdue après une écriture réussie : confirmer le même gagnant est sûr.
            Match recorded = find(id);
            if (recorded.status() != game.status()) throw conflict();
            return recorded;
        } catch (NoSuchElementException missing) {
            throw notFound();
        }
    }

    private Match find(UUID id) {
        try {
            return matches.find(id);
        } catch (NoSuchElementException missing) {
            throw notFound();
        }
    }

    private DameGameView owned(HttpSession session, UUID id) {
        Object stored = session.getAttribute(ATTRIBUTE);
        if (!(stored instanceof String json)) throw notFound();
        try {
            DameGameView view = mapper.readValue(json, DameGameView.class);
            if (view == null
                    || !id.equals(view.id())
                    || view.version() < 0
                    || view.status() != view.game(history(session)).status()) {
                throw notFound();
            }
            return view;
        } catch (JacksonException | IllegalArgumentException invalidState) {
            throw notFound();
        }
    }

    private DrawState history(HttpSession session) {
        Object stored = session.getAttribute(HISTORY);
        return stored instanceof String json ? mapper.readValue(json, DrawState.class) : null;
    }

    private void commit(HttpSession session, DameGameView view, DrawState history) {
        session.setAttribute(ATTRIBUTE, mapper.writeValueAsString(view));
        session.setAttribute(HISTORY, mapper.writeValueAsString(history));
    }

    private static Match metadata(DameGameView view) {
        return new Match(
                view.id(),
                view.whiteName(),
                view.blackName(),
                java.time.Instant.parse(view.startedAt()),
                view.status(),
                view.finishedAt() == null ? null : java.time.Instant.parse(view.finishedAt()));
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Rencontre introuvable dans cette session.");
    }

    private static ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "La partie a changé ou est terminée. Recharge-la avant de jouer.");
    }
}
