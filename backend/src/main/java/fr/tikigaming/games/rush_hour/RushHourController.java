package fr.tikigaming.games.rush_hour;

import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/rush-hour")
@Tag(name = "rush-hour", description = "Vérification serveur d'une partie de Rush Hour et calcul de son score.")
public class RushHourController {

    /** Un coup : glisser le véhicule de `delta` cases (négatif = gauche ou haut). */
    record RushHourMoveRequest(
            @Schema(example = "X")
            @NotNull
            @Pattern(regexp = "^[A-Z]$", message = "Véhicule invalide : une lettre majuscule")
            String vehicle,

            @Schema(example = "3") int delta) {}

    /** Partie gagnée envoyée par le front : la liste des coups joués et le nombre d'indices demandés. */
    record RushHourResultRequest(
            @NotNull(message = "La liste des coups est obligatoire") @Size(max = 500, message = "500 coups au maximum")
            List<@Valid @NotNull RushHourMoveRequest> moves,

            @Schema(example = "0")
            @NotNull(message = "Le nombre d'indices est obligatoire")
            @PositiveOrZero(message = "Le nombre d'indices ne peut pas être négatif")
            Integer hints) {}

    private final LevelResultService service;

    public RushHourController(LevelResultService service) {
        this.service = service;
    }

    @PostMapping("/levels/{level}/results")
    @Operation(
            summary = "Vérifier une partie gagnée et calculer son score",
            description = "Le serveur rejoue les coups sur le niveau et calcule lui-même le score : c'est ce score que "
                    + "le front envoie ensuite au classement.")
    @ApiResponse(responseCode = "200", description = "Partie valide : score, coups joués et minimum du niveau")
    @ApiResponse(
            responseCode = "400",
            description = "Corps invalide (coups absents, indices négatifs…)",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "404",
            description = "Niveau inconnu",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "422",
            description = "Partie refusée : coup illégal, voiture rouge non sortie ou score impossible",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public LevelResult verify(
            @Parameter(description = "Numéro du niveau, de 1 à 20", example = "1") @PathVariable int level,
            @Valid @RequestBody RushHourResultRequest request) {
        List<Move> moves = request.moves().stream()
                .map(m -> new Move(m.vehicle().charAt(0), m.delta()))
                .toList();
        return service.verify(level, moves, request.hints());
    }
}
