package fr.tikigaming.games.prismine;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/**
 * Scores classés dans la table scores de la plateforme, au nom du joueur. L'identifiant de l'expédition est rangé dans
 * {@code metadata.runId}, unique pour Prismine (index scores_prismine_run_idx) : une nouvelle tentative d'insertion
 * est refusée en 409 par PostgREST, ce qui veut dire que le score est déjà classé.
 */
@Component
public class SupabaseScoreRegistry implements ScoreRegistry {

    private final PrismineSupabase supabase;

    public SupabaseScoreRegistry(PrismineSupabase supabase) {
        this.supabase = supabase;
    }

    @Override
    public void record(UUID runId, String userId, long score, Map<String, Object> metadata) {
        Map<String, Object> withRun = new HashMap<>(metadata);
        withRun.put("runId", runId.toString());
        supabase.call(() -> supabase.rest()
                .post()
                .uri("/rest/v1/scores")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("user_id", userId, "game_slug", "prismine", "score", score, "metadata", withRun))
                .retrieve()
                // Déjà classé lors d'une tentative précédente : rien à faire.
                .onStatus(status -> status.value() == HttpStatus.CONFLICT.value(), (req, res) -> {})
                .toBodilessEntity());
    }
}
