package fr.tikigaming.games.prismine;

import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/** Scores classés dans la table scores de la plateforme, au nom du joueur. */
@Component
public class SupabaseScoreRegistry implements ScoreRegistry {

    private final PrismineSupabase supabase;

    public SupabaseScoreRegistry(PrismineSupabase supabase) {
        this.supabase = supabase;
    }

    @Override
    public void record(String userId, long score, Map<String, Object> metadata) {
        supabase.call(() -> supabase.rest()
                .post()
                .uri("/rest/v1/scores")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("user_id", userId, "game_slug", "prismine", "score", score, "metadata", metadata))
                .retrieve()
                .toBodilessEntity());
    }
}
