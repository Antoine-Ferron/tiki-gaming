package fr.tikigaming.games.prismine;

import fr.tikigaming.games.GameException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Expéditions en cours dans la table prismine_runs (état JSON), accessible au seul backend. La colonne {@code version}
 * sert de verrou optimiste ; {@code updated_at} est tenue à jour par un trigger et sert à la purge.
 */
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
    public void insert(Run run) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", run.id());
        row.put("user_id", run.userId()); // null pour un invité
        row.put("version", run.version());
        row.put("state", mapper.valueToTree(run));
        supabase.call(() -> supabase.rest()
                .post()
                .uri(TABLE)
                .contentType(MediaType.APPLICATION_JSON)
                .body(row)
                .retrieve()
                .toBodilessEntity());
    }

    @Override
    public void update(Run run) {
        // Le filtre sur la version précédente rend l'écriture atomique : 0 ligne modifiée = quelqu'un est passé avant.
        JsonNode updated = supabase.call(() -> supabase.rest()
                .patch()
                .uri(b -> b.path(TABLE)
                        .queryParam("id", "eq." + run.id())
                        .queryParam("version", "eq." + (run.version() - 1))
                        .build())
                .header("Prefer", "return=representation")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("version", run.version(), "state", mapper.valueToTree(run)))
                .retrieve()
                .body(JsonNode.class));
        if (updated == null || updated.isEmpty()) throw new GameException(409, CONFLICT);
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
        } catch (JacksonException e) {
            throw new IllegalStateException("État d'expédition illisible : " + id, e);
        }
    }

    @Override
    public void delete(UUID id) {
        deleteWhere("id", "eq." + id);
    }

    @Override
    public void deleteByUser(String userId) {
        deleteWhere("user_id", "eq." + userId);
    }

    @Override
    public void deleteInactiveSince(Instant cutoff) {
        deleteWhere("updated_at", "lt." + cutoff);
    }

    private void deleteWhere(String column, String filter) {
        supabase.call(() -> supabase.rest()
                .delete()
                .uri(b -> b.path(TABLE).queryParam(column, filter).build())
                .retrieve()
                .toBodilessEntity());
    }
}
