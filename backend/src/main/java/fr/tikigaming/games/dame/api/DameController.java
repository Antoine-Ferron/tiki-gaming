package fr.tikigaming.games.dame.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/dame/matches")
@Tag(name = "dame", description = "Partie locale à deux, conservée dans la session qui l'a créée.")
@ApiResponse(responseCode = "400", description = "Saisie ou coup invalide")
@ApiResponse(responseCode = "403", description = "Jeton CSRF absent ou invalide")
@ApiResponse(responseCode = "502", description = "Stockage temporairement indisponible")
public class DameController {

    private final DameApplicationService service;

    public DameController(DameApplicationService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(
            summary = "Démarrer une rencontre de dames",
            description = "Enregistre les deux noms et crée le plateau côté serveur.")
    @ApiResponse(responseCode = "201", description = "Rencontre créée")
    ResponseEntity<DameGameView> start(@Valid @RequestBody DameRequests.Start body, HttpServletRequest request) {
        DameGameView view = service.start(request.getSession(true), body.whiteName(), body.blackName());
        return ResponseEntity.created(URI.create("/api/games/dame/matches/" + (view == null ? "pending" : view.id())))
                .body(view);
    }

    @GetMapping("/{id}")
    @Operation(
            summary = "Lire sa rencontre de dames",
            description = "L'identifiant doit appartenir à la session courante.")
    @ApiResponse(responseCode = "200", description = "État de la partie")
    @ApiResponse(responseCode = "404", description = "Rencontre absente de cette session")
    DameGameView read(@PathVariable UUID id, HttpServletRequest request) {
        return service.read(request.getSession(false), id);
    }

    @PostMapping("/{id}/moves")
    @Operation(
            summary = "Jouer un coup de dames",
            description = "Le serveur valide le parcours complet et enregistre une éventuelle victoire.")
    @ApiResponse(responseCode = "200", description = "Coup joué")
    @ApiResponse(responseCode = "404", description = "Rencontre absente de cette session")
    @ApiResponse(responseCode = "409", description = "Version périmée ou rencontre terminée")
    DameGameView play(@PathVariable UUID id, @Valid @RequestBody DameRequests.Play body, HttpServletRequest request) {
        return service.play(request.getSession(false), id, body.version(), body.move());
    }
}
