package fr.tikigaming.games.dame.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/dame/matches")
@Tag(name = "dame", description = "Partie locale à deux, sauvegardée pour le navigateur qui l'a créée.")
@ApiResponse(responseCode = "400", description = "Saisie ou coup invalide")
@ApiResponse(responseCode = "403", description = "Jeton CSRF absent ou invalide")
@ApiResponse(responseCode = "502", description = "Stockage temporairement indisponible")
public class DameController {

    static final String COOKIE = "DAME-RESUME";

    private final DameApplicationService service;

    public DameController(DameApplicationService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(
            summary = "Démarrer une rencontre de dames",
            description = "Enregistre les deux noms et crée le plateau côté serveur.")
    @ApiResponse(responseCode = "201", description = "Rencontre créée")
    ResponseEntity<DameGameView> start(
            @Valid @RequestBody DameRequests.Start body, HttpServletRequest request, HttpServletResponse response) {
        DameGameView view = service.start(request.getSession(true), body.whiteName(), body.blackName());
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                ResponseCookie.from(
                                COOKIE, (String) request.getSession(false).getAttribute(DameApplicationService.OWNER))
                        .httpOnly(true)
                        .secure(request.isSecure())
                        .sameSite("Strict")
                        .path("/api/games/dame")
                        .maxAge(java.time.Duration.ofDays(30))
                        .build()
                        .toString());
        return ResponseEntity.created(URI.create("/api/games/dame/matches/" + view.id()))
                .body(view);
    }

    @GetMapping("/{id}")
    @Operation(
            summary = "Lire sa rencontre de dames",
            description = "Le cookie privé de ce navigateur est requis, même après un redémarrage serveur.")
    @ApiResponse(responseCode = "200", description = "État de la partie")
    @ApiResponse(responseCode = "404", description = "Rencontre absente de cette session")
    DameGameView read(@PathVariable UUID id, HttpServletRequest request) {
        return service.read(owner(request), id);
    }

    @PostMapping("/{id}/moves")
    @Operation(
            summary = "Jouer un coup de dames",
            description = "Le serveur valide le parcours complet et enregistre une éventuelle victoire.")
    @ApiResponse(responseCode = "200", description = "Coup joué")
    @ApiResponse(responseCode = "404", description = "Rencontre absente de cette session")
    @ApiResponse(responseCode = "409", description = "Version périmée ou rencontre terminée")
    DameGameView play(@PathVariable UUID id, @Valid @RequestBody DameRequests.Play body, HttpServletRequest request) {
        return service.play(owner(request), id, body.version(), body.move());
    }

    private static HttpSession owner(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if (COOKIE.equals(cookie.getName()) && cookie.getValue().matches("[0-9a-f]{64}")) {
                    HttpSession session = request.getSession(true);
                    session.setAttribute(DameApplicationService.OWNER, cookie.getValue());
                    return session;
                }
            }
        }
        return request.getSession(false);
    }
}
