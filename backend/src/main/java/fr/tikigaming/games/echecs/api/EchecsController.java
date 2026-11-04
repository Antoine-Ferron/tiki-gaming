package fr.tikigaming.games.echecs.api;

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
public class EchecsController {

    /** Une FEN réelle fait au plus ~90 caractères : au-delà, la requête est refusée avant le moteur. */
    static final int MAX_FEN_LENGTH = 100;

    /** Demande des cases accessibles depuis une case. */
    record DestinationsRequest(
            @NotBlank(message = "La position (FEN) est obligatoire")
            @Size(max = MAX_FEN_LENGTH, message = "La position (FEN) est trop longue")
            String fen,

            @NotBlank(message = "La case de départ est obligatoire")
            @Size(max = 2, message = "Une case s'écrit en 2 caractères")
            String from) {}

    /** Les cases accessibles, triées. */
    record DestinationsResponse(List<String> destinations) {}

    /** Un coup à jouer sur une position. */
    record MoveRequest(
            @NotBlank(message = "La position (FEN) est obligatoire")
            @Size(max = MAX_FEN_LENGTH, message = "La position (FEN) est trop longue")
            String fen,

            @NotBlank(message = "La case de départ est obligatoire")
            @Size(max = 2, message = "Une case s'écrit en 2 caractères")
            String from,

            @NotBlank(message = "La case d'arrivée est obligatoire")
            @Size(max = 2, message = "Une case s'écrit en 2 caractères")
            String to) {}

    /** La position après le coup. */
    record MoveResponse(String fen) {}

    private final EchecsService service;

    public EchecsController(EchecsService service) {
        this.service = service;
    }

    @PostMapping("/destinations")
    public DestinationsResponse destinations(@Valid @RequestBody DestinationsRequest request) {
        return new DestinationsResponse(service.destinations(request.fen(), request.from()));
    }

    @PostMapping("/moves")
    public MoveResponse play(@Valid @RequestBody MoveRequest request) {
        return new MoveResponse(service.play(request.fen(), request.from(), request.to()));
    }
}
