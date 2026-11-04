package fr.tikigaming.games.echecs.api;

import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** API du jeu d'échecs : sans état, le front envoie la position (FEN) à chaque requête. */
@RestController
@RequestMapping("/api/games/echecs")
public class EchecsController {

    /** Demande des cases accessibles depuis une case. */
    record DestinationsRequest(String fen, String from) {}

    /** Les cases accessibles, triées. */
    record DestinationsResponse(List<String> destinations) {}

    /** Un coup à jouer sur une position. */
    record MoveRequest(String fen, String from, String to) {}

    /** La position après le coup. */
    record MoveResponse(String fen) {}

    private final EchecsService service;

    public EchecsController(EchecsService service) {
        this.service = service;
    }

    @PostMapping("/destinations")
    public DestinationsResponse destinations(@RequestBody DestinationsRequest request) {
        return new DestinationsResponse(service.destinations(request.fen(), request.from()));
    }

    @PostMapping("/moves")
    public MoveResponse play(@RequestBody MoveRequest request) {
        return new MoveResponse(service.play(request.fen(), request.from(), request.to()));
    }
}
