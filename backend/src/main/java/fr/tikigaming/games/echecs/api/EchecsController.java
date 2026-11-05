package fr.tikigaming.games.echecs.api;

import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** API du jeu d'échecs : sans état, le front envoie la position (FEN) à chaque requête. */
@RestController
@RequestMapping("/api/games/echecs")
@Tag(name = "echecs", description = "Règles des échecs côté serveur : cases accessibles et coups joués (sans état).")
public class EchecsController {

    /** Une FEN réelle fait au plus ~90 caractères : au-delà, la requête est refusée avant le moteur. */
    static final int MAX_FEN_LENGTH = 100;

    private static final String START_EXAMPLE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    /** Demande des cases accessibles depuis une case. */
    record DestinationsRequest(
            @Schema(description = "Position en notation FEN", example = START_EXAMPLE)
            @NotBlank(message = "La position (FEN) est obligatoire")
            @Size(max = MAX_FEN_LENGTH, message = "La position (FEN) est trop longue")
            String fen,

            @Schema(description = "Case de départ", example = "e2")
            @NotBlank(message = "La case de départ est obligatoire")
            @Size(max = 2, message = "Une case s'écrit en 2 caractères")
            String from) {}

    /** Les cases accessibles, triées. */
    record DestinationsResponse(
            @Schema(example = "[\"e3\", \"e4\"]") List<String> destinations) {}

    /** Un coup à jouer sur une position. */
    record MoveRequest(
            @Schema(description = "Position en notation FEN", example = START_EXAMPLE)
            @NotBlank(message = "La position (FEN) est obligatoire")
            @Size(max = MAX_FEN_LENGTH, message = "La position (FEN) est trop longue")
            String fen,

            @Schema(description = "Case de départ", example = "e2")
            @NotBlank(message = "La case de départ est obligatoire")
            @Size(max = 2, message = "Une case s'écrit en 2 caractères")
            String from,

            @Schema(description = "Case d'arrivée", example = "e4")
            @NotBlank(message = "La case d'arrivée est obligatoire")
            @Size(max = 2, message = "Une case s'écrit en 2 caractères")
            String to) {}

    /** La position après le coup. */
    record MoveResponse(
            @Schema(
                    description = "Position après le coup (FEN)",
                    example = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")
            String fen) {}

    private final EchecsService service;

    public EchecsController(EchecsService service) {
        this.service = service;
    }

    @PostMapping("/destinations")
    @Operation(
            summary = "Cases accessibles d'une pièce",
            description = "Les cases où peut aller la pièce posée sur la case de départ, triées. Ne vérifie pas "
                    + "encore l'échec au roi (phase 3).")
    @ApiResponse(responseCode = "200", description = "Cases accessibles (liste vide si la case est libre)")
    @ApiResponse(
            responseCode = "400",
            description = "Corps incomplet, FEN ou case mal écrite",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public DestinationsResponse destinations(@Valid @RequestBody DestinationsRequest request) {
        return new DestinationsResponse(service.destinations(request.fen(), request.from()));
    }

    @PostMapping("/moves")
    @Operation(
            summary = "Jouer un coup",
            description = "Le serveur vérifie le coup selon les règles et renvoie la position suivante en FEN.")
    @ApiResponse(responseCode = "200", description = "Coup joué : nouvelle position")
    @ApiResponse(
            responseCode = "400",
            description = "Corps incomplet, FEN ou case mal écrite",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "422",
            description = "Coup refusé par les règles : case vide, pas le trait, case inaccessible",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public MoveResponse play(@Valid @RequestBody MoveRequest request) {
        return new MoveResponse(service.play(request.fen(), request.from(), request.to()));
    }
}
