package fr.tikigaming.games.sdv_civilisation.api;

import static fr.tikigaming.games.sdv_civilisation.api.SdvCivilisationConfig.SLUG;

import fr.tikigaming.games.sdv_civilisation.ScoreBreakdown;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/**
 * Parties et scores des joueurs connectés, dans les tables existantes de Supabase (API REST, clé service) :
 * {@code game_saves} (une ligne par joueur, la partie scellée) et {@code scores} (classement de la plateforme).
 */
@Component
public class SupabaseGames implements UserGames, ScoreRecorder {

    private static final String ROW = "/rest/v1/game_saves?user_id=eq.{user}&game_slug=eq.{slug}";

    private final RestClient supabase;
    private final SealedState sealer;

    public SupabaseGames(RestClient sdvCivilisationSupabase, SealedState sealer) {
        this.supabase = sdvCivilisationSupabase;
        this.sealer = sealer;
    }

    @Override
    public GameStore forUser(String userId) {
        return new GameStore() {
            @Override
            public Optional<SavedGame> load() {
                JsonNode rows = supabase.get()
                        .uri(ROW + "&select=data", userId, SLUG)
                        .retrieve()
                        .body(JsonNode.class);
                if (rows == null || rows.isEmpty()) return Optional.empty();
                return sealer.unseal(rows.get(0).path("data").path("sealed").asString(""));
            }

            @Override
            public void save(SavedGame game, int expectedVersion) {
                Map<String, Object> data = Map.of("version", game.version(), "sealed", sealer.seal(game));
                if (expectedVersion == 0) {
                    supabase.post()
                            .uri("/rest/v1/game_saves?on_conflict=user_id,game_slug")
                            .header("Prefer", "resolution=merge-duplicates,return=minimal")
                            .body(Map.of("user_id", userId, "game_slug", SLUG, "data", data))
                            .retrieve()
                            .toBodilessEntity();
                    return;
                }
                // Verrou optimiste : la ligne n'est modifiée que si elle est encore à la version attendue.
                JsonNode updated = supabase.patch()
                        .uri(ROW + "&data->>version=eq.{version}", userId, SLUG, expectedVersion)
                        .header("Prefer", "return=representation")
                        .body(Map.of("data", data))
                        .retrieve()
                        .body(JsonNode.class);
                if (updated == null || updated.isEmpty()) throw new StaleGameException();
            }

            @Override
            public void clear() {
                supabase.delete().uri(ROW, userId, SLUG).retrieve().toBodilessEntity();
            }
        };
    }

    @Override
    public void record(String userId, ScoreBreakdown score) {
        supabase.post()
                .uri("/rest/v1/scores")
                .header("Prefer", "return=minimal")
                .body(Map.of("user_id", userId, "game_slug", SLUG, "score", score.total(), "metadata", score))
                .retrieve()
                .toBodilessEntity();
    }
}
