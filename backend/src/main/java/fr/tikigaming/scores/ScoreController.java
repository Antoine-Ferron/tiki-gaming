package fr.tikigaming.scores;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

@RestController
@RequestMapping("/api/scores")
@Tag(
        name = "Scores",
        description = "Enregistrement des scores. Seul le backend écrit dans public.scores : "
                + "le classement se lit directement dans Supabase.")
public class ScoreController {

    static final String NOT_SIGNED_IN = "Connecte-toi pour enregistrer ton score.";
    static final String INVALID_METADATA = "Les détails de la partie sont invalides.";
    /** Taille maximale des détails d'une partie (JSON sérialisé), lisibles par tous dans le classement. */
    static final int MAX_METADATA_CHARS = 16_384;

    record ScoreRequest(
            @Schema(example = "clicker") @NotBlank(message = "Indique le jeu.")
            String gameSlug,

            @Schema(example = "120", minimum = "0")
            @NotNull(message = "Indique le score.")
            @PositiveOrZero(message = "Le score ne peut pas être négatif.")
            Long score,

            @Schema(description = "Détails libres de la partie (objet JSON)", example = "{\"durationMs\": 10000}")
            JsonNode metadata) {}

    private final ScoreService scores;

    public ScoreController(ScoreService scores) {
        this.scores = scores;
    }

    @PostMapping
    @Operation(
            summary = "Enregistrer un score",
            description = "Enregistre le score du joueur connecté (session HTTP). Le jeu doit être actif et le "
                    + "score ne pas dépasser son maximum ; un jeu peut ajouter sa propre vérification.")
    @ApiResponse(responseCode = "204", description = "Score enregistré", content = @Content)
    @ApiResponse(responseCode = "400", description = "Score négatif, au-dessus du maximum, ou détails invalides")
    @ApiResponse(responseCode = "401", description = "Non connecté")
    @ApiResponse(responseCode = "403", description = "Jeu fermé")
    @ApiResponse(responseCode = "404", description = "Jeu inconnu")
    ResponseEntity<Void> submit(@Valid @RequestBody ScoreRequest body, HttpServletRequest request) {
        AuthUser player = AuthSession.currentUser(request);
        if (player == null) throw new ApiException(HttpStatus.UNAUTHORIZED, NOT_SIGNED_IN);
        scores.submit(player, body.gameSlug(), body.score(), metadata(body.metadata()));
        return ResponseEntity.noContent().build();
    }

    private static JsonNode metadata(JsonNode metadata) {
        if (metadata == null || metadata.isNull()) return JsonNodeFactory.instance.objectNode();
        if (!metadata.isObject() || metadata.toString().length() > MAX_METADATA_CHARS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_METADATA);
        }
        return metadata;
    }
}
