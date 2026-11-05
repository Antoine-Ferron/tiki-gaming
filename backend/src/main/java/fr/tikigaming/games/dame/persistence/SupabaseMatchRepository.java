package fr.tikigaming.games.dame.persistence;

import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.matches.Match;
import fr.tikigaming.games.dame.matches.MatchRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Adaptateur PostgREST ; le client fourni porte l'URL REST et les droits serveur. */
public final class SupabaseMatchRepository implements MatchRepository {

    private final RestClient rest;
    private final ObjectMapper mapper;

    public SupabaseMatchRepository(RestClient rest, ObjectMapper mapper) {
        this.rest = Objects.requireNonNull(rest);
        this.mapper = Objects.requireNonNull(mapper);
    }

    @Override
    public Optional<Match> findById(UUID id) {
        Objects.requireNonNull(id);
        try {
            JsonNode rows = rows(
                    rest.get().uri("/dame_matches?id=eq.{id}", id).retrieve().body(String.class));
            if (rows.isEmpty()) return Optional.empty();
            JsonNode row = rows.get(0);
            checkIdentifier(row, id);
            JsonNode end = row.path("finished_at");
            return Optional.of(new Match(
                    id,
                    row.path("white_name").asString(),
                    row.path("black_name").asString(),
                    Instant.parse(row.path("started_at").asString()),
                    GameStatus.valueOf(row.path("status").asString()),
                    end.isNull() ? null : Instant.parse(end.asString())));
        } catch (RestClientException | JacksonException | IllegalArgumentException e) {
            throw new MatchStorageException(e);
        }
    }

    @Override
    public void save(Match match) {
        Objects.requireNonNull(match);
        try {
            if (match.status() == GameStatus.IN_PROGRESS) {
                rest.post()
                        .uri("/dame_matches")
                        .header("Prefer", "return=minimal")
                        .body(creationBody(match))
                        .retrieve()
                        .toBodilessEntity();
                return;
            }
            // Le filtre est réévalué par PostgreSQL sous verrou : une seule clôture concurrente réussit.
            JsonNode changed = rows(rest.patch()
                    .uri("/dame_matches?id=eq.{id}&status=eq.IN_PROGRESS", match.id())
                    .header("Prefer", "return=representation")
                    .body(Map.of("status", match.status().name(), "finished_at", time(match.finishedAt())))
                    .retrieve()
                    .body(String.class));
            if (changed.isEmpty()) {
                throw new IllegalStateException("Rencontre inconnue ou déjà terminée.");
            }
            checkIdentifier(changed.get(0), match.id());
        } catch (HttpClientErrorException.Conflict conflict) {
            throw new IllegalStateException("Cet identifiant de rencontre existe déjà.");
        } catch (RestClientException | JacksonException | IllegalArgumentException e) {
            throw new MatchStorageException(e);
        }
    }

    private static Map<String, Object> creationBody(Match match) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", match.id());
        body.put("white_name", match.whiteName());
        body.put("black_name", match.blackName());
        body.put("started_at", time(match.startedAt()));
        body.put("status", match.status().name());
        body.put("finished_at", null);
        return body;
    }

    private static String time(Instant instant) {
        return instant.truncatedTo(ChronoUnit.MICROS).toString();
    }

    private JsonNode rows(String body) {
        if (body == null || body.isBlank()) throw new IllegalArgumentException("Réponse de stockage absente.");
        JsonNode rows = mapper.readTree(body);
        if (!rows.isArray() || rows.size() > 1) throw new IllegalArgumentException("Réponse de stockage invalide.");
        return rows;
    }

    private static void checkIdentifier(JsonNode row, UUID expected) {
        if (!expected.toString().equals(row.path("id").asString())) {
            throw new IllegalArgumentException("Identifiant inattendu dans la réponse du stockage.");
        }
    }
}
