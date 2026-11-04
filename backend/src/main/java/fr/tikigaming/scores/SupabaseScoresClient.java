package fr.tikigaming.scores;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.config.TikiProperties;
import java.io.InputStream;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Insertion des scores dans public.scores via PostgREST, avec la clé service_role : c'est le seul chemin d'écriture
 * (les joueurs n'ont plus le droit d'insérer). Les règles du catalogue sont vérifiées en base par le trigger
 * scores_check_allowed ; ses refus sont traduits en messages pour le joueur.
 */
@Component
public class SupabaseScoresClient {

    static final String UNKNOWN_GAME = "Ce jeu n’existe pas.";
    static final String CLOSED_GAME = "Ce jeu est fermé : il n’accepte plus de scores.";
    static final String SCORE_TOO_HIGH = "Score refusé : il dépasse le maximum de ce jeu.";
    static final String UNAVAILABLE = "Le service des scores rencontre un problème. Réessaie plus tard.";

    private static final Logger log = LoggerFactory.getLogger(SupabaseScoresClient.class);

    private final RestClient rest;

    public SupabaseScoresClient(RestClient.Builder builder, TikiProperties props, ObjectMapper mapper) {
        String serviceRoleKey = props.supabase().serviceRoleKey();
        this.rest = builder.baseUrl(props.supabase().url())
                .defaultHeaders(h -> {
                    h.set("apikey", serviceRoleKey);
                    h.setBearerAuth(serviceRoleKey);
                })
                .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
                    throw refusal(res.getStatusCode().value(), readError(mapper, res.getBody()));
                })
                .build();
    }

    public void insert(String userId, String gameSlug, long score, JsonNode metadata) {
        try {
            rest.post()
                    .uri("/rest/v1/scores")
                    .header("Prefer", "return=minimal")
                    .body(Map.of("user_id", userId, "game_slug", gameSlug, "score", score, "metadata", metadata))
                    .retrieve()
                    .toBodilessEntity();
        } catch (ResourceAccessException e) {
            log.error("Supabase injoignable pendant l'envoi d'un score", e);
            throw new ApiException(HttpStatus.BAD_GATEWAY, UNAVAILABLE);
        }
    }

    /** Code SQLSTATE (ou PGRST) et message de l'erreur PostgREST ; vides si le corps n'est pas lisible. */
    private record PostgrestError(String code, String message) {}

    private static ApiException refusal(int status, PostgrestError error) {
        // Clé étrangère : le jeu, ou plus rarement le profil du joueur, est absent.
        if (error.code().equals("23503") && error.message().contains("scores_game_slug_fkey")) {
            return new ApiException(HttpStatus.NOT_FOUND, UNKNOWN_GAME);
        }
        if (error.code().equals("55000")) return new ApiException(HttpStatus.FORBIDDEN, CLOSED_GAME);
        if (error.code().equals("23514")) return new ApiException(HttpStatus.BAD_REQUEST, SCORE_TOO_HIGH);
        log.warn("PostgREST a refusé un score ({}, {}) : {}", status, error.code(), error.message());
        return new ApiException(HttpStatus.BAD_GATEWAY, UNAVAILABLE);
    }

    private static PostgrestError readError(ObjectMapper mapper, InputStream body) {
        try {
            JsonNode json = mapper.readTree(body);
            if (json == null) return new PostgrestError("", "");
            return new PostgrestError(
                    json.path("code").asString(""), json.path("message").asString(""));
        } catch (JacksonException ignored) {
            return new PostgrestError("", "");
        }
    }
}
