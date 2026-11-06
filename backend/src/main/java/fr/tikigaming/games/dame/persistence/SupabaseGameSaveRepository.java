package fr.tikigaming.games.dame.persistence;

import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.matches.GameSave;
import fr.tikigaming.games.dame.matches.GameSaveRepository;
import fr.tikigaming.games.dame.matches.Match;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Transaction PostgREST propre aux Dames ; seuls les condensats des cookies sont stockés. */
public final class SupabaseGameSaveRepository implements GameSaveRepository {
    private final RestClient rest;
    private final ObjectMapper json;

    public SupabaseGameSaveRepository(RestClient rest, ObjectMapper json) {
        this.rest = java.util.Objects.requireNonNull(rest);
        this.json = java.util.Objects.requireNonNull(json);
    }

    @Override
    public Optional<GameSave> findOwned(UUID id, String ownerHash) {
        try {
            String body = rest.get()
                    .uri("/dame_game_saves?id=eq.{id}&owner_hash=eq.{owner}&select=*,dame_matches(*)", id, ownerHash)
                    .retrieve()
                    .body(String.class);
            JsonNode rows = json.readTree(body);
            if (rows == null || !rows.isArray() || rows.size() > 1) {
                throw new IllegalArgumentException("Réponse invalide.");
            }
            if (rows.isEmpty()) return Optional.empty();
            JsonNode row = rows.get(0);
            if (!id.toString().equals(row.path("id").asString())
                    || !ownerHash.equals(row.path("owner_hash").asString())) {
                throw new IllegalArgumentException("Sauvegarde étrangère.");
            }
            JsonNode m = row.path("dame_matches");
            Match match = new Match(
                    UUID.fromString(m.path("id").asString()),
                    m.path("white_name").asString(),
                    m.path("black_name").asString(),
                    Instant.parse(m.path("started_at").asString()),
                    GameStatus.valueOf(m.path("status").asString()),
                    m.path("finished_at").isNull()
                            ? null
                            : Instant.parse(m.path("finished_at").asString()));
            if (!match.id().equals(id) || !row.path("version").isInt()) {
                throw new IllegalArgumentException("Version invalide.");
            }
            return Optional.of(new GameSave(
                    match, ownerHash, row.path("version").intValue(), json.writeValueAsString(row.path("state"))));
        } catch (RestClientException | JacksonException | IllegalArgumentException e) {
            throw new MatchStorageException(e);
        }
    }

    @Override
    public void save(GameSave save) {
        try {
            Match match = save.match();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("p_id", match.id());
            body.put("p_owner_hash", save.ownerHash());
            body.put("p_version", save.version());
            body.put("p_state", json.readTree(save.state()));
            body.put("p_white_name", match.whiteName());
            body.put("p_black_name", match.blackName());
            body.put("p_started_at", match.startedAt().toString());
            body.put("p_status", match.status().name());
            body.put(
                    "p_finished_at",
                    match.finishedAt() == null ? null : match.finishedAt().toString());
            Boolean accepted =
                    rest.post().uri("/rpc/dame_save_game").body(body).retrieve().body(Boolean.class);
            if (Boolean.FALSE.equals(accepted)) throw new IllegalStateException("La sauvegarde a changé.");
            if (accepted == null) throw new IllegalArgumentException("Confirmation absente.");
        } catch (HttpClientErrorException.Conflict conflict) {
            throw new IllegalStateException("La rencontre existe déjà.");
        } catch (RestClientException | JacksonException | IllegalArgumentException e) {
            throw new MatchStorageException(e);
        }
    }
}
