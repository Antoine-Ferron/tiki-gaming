package fr.tikigaming.games.dame.api;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.dame.DrawState;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.matches.GameSave;
import fr.tikigaming.games.dame.matches.GameSaveRepository;
import fr.tikigaming.games.dame.matches.Match;
import jakarta.servlet.http.HttpSession;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Orchestration : le stockage fait autorité, y compris après perte de session. */
public final class DameApplicationService {
    static final String ATTRIBUTE = "dame.current";
    static final String OWNER = "dame.owner";
    private static final SecureRandom RANDOM = new SecureRandom();
    private final GameSaveRepository repository;
    private final Clock clock;
    private final Supplier<UUID> ids;
    private final ObjectMapper mapper;

    public record State(DameGameView view, DrawState history) {}

    public DameApplicationService(GameSaveRepository repository, Clock clock, Supplier<UUID> ids, ObjectMapper mapper) {
        this.repository = Objects.requireNonNull(repository);
        this.clock = Objects.requireNonNull(clock);
        this.ids = Objects.requireNonNull(ids);
        this.mapper = Objects.requireNonNull(mapper);
    }

    public DameGameView start(HttpSession session, String whiteName, String blackName) {
        synchronized (session) {
            Match match;
            try {
                match = Match.start(ids.get(), whiteName, blackName, clock.instant());
            } catch (IllegalArgumentException error) {
                throw new ApiException(HttpStatus.BAD_REQUEST, error.getMessage());
            }
            byte[] bytes = new byte[32];
            RANDOM.nextBytes(bytes);
            String token = HexFormat.of().formatHex(bytes);
            Game game = new Game();
            DameGameView view = DameGameView.of(match, game, 0);
            persist(match, view, game.drawState(), hash(token));
            session.setAttribute(OWNER, token);
            commit(session, view);
            return view;
        }
    }

    public DameGameView read(HttpSession session, UUID id) {
        State state = owned(session, id);
        commit(session, state.view());
        return state.view();
    }

    public DameGameView play(HttpSession session, UUID id, int version, Move move) {
        if (session == null) throw notFound();
        synchronized (session) {
            State state = owned(session, id);
            DameGameView before = state.view();
            if (before.version() != version
                    || before.status() != GameStatus.IN_PROGRESS
                    || version == Integer.MAX_VALUE) {
                throw conflict();
            }
            Game next = before.game(state.history());
            try {
                next.play(move);
            } catch (IllegalArgumentException error) {
                throw new ApiException(HttpStatus.BAD_REQUEST, error.getMessage());
            }
            Match match = metadata(before);
            if (next.status() != GameStatus.IN_PROGRESS) match = match.finish(next.status(), clock.instant());
            DameGameView after = DameGameView.of(match, next, version + 1);
            persist(match, after, next.drawState(), ownerHash(session));
            commit(session, after);
            return after;
        }
    }

    private void persist(Match match, DameGameView view, DrawState history, String ownerHash) {
        try {
            repository.save(new GameSave(
                    match, ownerHash, view.version(), mapper.writeValueAsString(new State(view, history))));
        } catch (IllegalStateException stale) {
            throw conflict();
        }
    }

    private State owned(HttpSession session, UUID id) {
        GameSave saved = repository.findOwned(id, ownerHash(session)).orElseThrow(DameApplicationService::notFound);
        try {
            State state = mapper.readValue(saved.state(), State.class);
            DameGameView view = state.view();
            if (state.history() == null
                    || !id.equals(view.id())
                    || view.version() != saved.version()
                    || !metadata(view).equals(saved.match())
                    || view.status() != view.game(state.history()).status()) {
                throw notFound();
            }
            return state;
        } catch (JacksonException | IllegalArgumentException | NullPointerException damaged) {
            throw notFound();
        }
    }

    private static String ownerHash(HttpSession session) {
        if (session == null
                || !(session.getAttribute(OWNER) instanceof String token)
                || !token.matches("[0-9a-f]{64}")) {
            throw notFound();
        }
        return hash(token);
    }

    static String hash(String token) {
        try {
            return HexFormat.of()
                    .formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 indisponible", impossible);
        }
    }

    private void commit(HttpSession session, DameGameView view) {
        session.setAttribute(ATTRIBUTE, mapper.writeValueAsString(view));
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
        return new ApiException(HttpStatus.NOT_FOUND, "Rencontre introuvable dans ce navigateur.");
    }

    private static ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "La partie a changé ou est terminée. Recharge-la avant de jouer.");
    }
}
