package fr.tikigaming.games.prismine;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/** Expéditions en cours dans la table prismine_runs (état JSON), accessible au seul backend. */
@Component
public class SupabaseRunRepository implements RunRepository {

    private static final String TABLE = "/rest/v1/prismine_runs";

    private final PrismineSupabase supabase;
    private final ObjectMapper mapper;

    public SupabaseRunRepository(PrismineSupabase supabase, ObjectMapper mapper) {
        this.supabase = supabase;
        this.mapper = mapper;
    }

    @Override
    public void save(Run run) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", run.id());
        row.put("user_id", run.userId()); // null pour un invité
        row.put("state", mapper.valueToTree(run));
        supabase.call(() -> supabase.rest()
                .post()
                .uri(TABLE)
                .header("Prefer", "resolution=merge-duplicates")
                .contentType(MediaType.APPLICATION_JSON)
                .body(row)
                .retrieve()
                .toBodilessEntity());
    }

    @Override
    public Optional<Run> find(UUID id) {
        JsonNode rows = supabase.call(() -> supabase.rest()
                .get()
                .uri(b -> b.path(TABLE)
                        .queryParam("id", "eq." + id)
                        .queryParam("select", "state")
                        .build())
                .retrieve()
                .body(JsonNode.class));
        if (rows == null || rows.isEmpty()) return Optional.empty();
        try {
            return Optional.of(mapper.treeToValue(rows.get(0).get("state"), Run.class));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("État d'expédition illisible : " + id, e);
        }
    }

    @Override
    public void delete(UUID id) {
        supabase.call(() -> supabase.rest()
                .delete()
                .uri(b -> b.path(TABLE).queryParam("id", "eq." + id).build())
                .retrieve()
                .toBodilessEntity());
    }
}
