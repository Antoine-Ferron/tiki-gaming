package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import fr.tikigaming.games.sdv_civilisation.ActionType;
import fr.tikigaming.games.sdv_civilisation.GameRuleException;
import fr.tikigaming.games.sdv_civilisation.Wonder;
import fr.tikigaming.games.sdv_civilisation.Wonders;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/sdv-civilisation")
@Tag(
        name = "SDV Civilisation",
        description = "Partie contre deux IA, arbitrée par le serveur. Un invité garde sa partie dans sa session ; "
                + "un joueur connecté la retrouve sur tous ses appareils et son score part au classement.")
public class SdvCivilisationController {

    record StartRequest(
            @Schema(example = "Citadelle d’Orkan") @NotBlank(message = "Choisis ta merveille pour commencer.")
            String wonder) {}

    record TurnRequest(
            @Schema(description = "Position de la carte dans la main", example = "0")
            @NotNull(message = "Choisis une carte.")
            @Min(value = 0, message = "Choisis une carte de ta main.")
            Integer card,

            @Schema(example = "build") @NotNull(message = "Choisis une action.")
            ActionType action,

            @Schema(description = "Version de la partie sur laquelle le coup a été choisi", example = "1")
            @NotNull(message = "Version de la partie manquante.")
            Integer version) {}

    record Conflict(String error, GameView game) {}

    private final SdvCivilisationService service;
    private final UserGames accounts;

    public SdvCivilisationController(SdvCivilisationService service, UserGames accounts) {
        this.service = service;
        this.accounts = accounts;
    }

    @GetMapping("/wonders")
    @Operation(summary = "Merveilles proposées", description = "Plateaux parmi lesquels le joueur choisit le sien.")
    List<Wonder> wonders() {
        return Wonders.ALL;
    }

    @GetMapping("/games/current")
    @Operation(
            summary = "Partie à reprendre",
            description = "Si le minuteur du tour a expiré entre-temps, une carte est d'abord défaussée au hasard.")
    @ApiResponse(responseCode = "200", description = "Partie en cours ou terminée")
    @ApiResponse(responseCode = "204", description = "Aucune partie", content = @Content)
    ResponseEntity<GameView> current(HttpServletRequest request) {
        return service.current(store(request), userId(request))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/games")
    @Operation(summary = "Nouvelle partie", description = "Remplace la partie en cours, considérée comme abandonnée.")
    @ApiResponse(responseCode = "201", description = "Partie commencée")
    @ApiResponse(responseCode = "400", description = "Merveille absente ou inconnue")
    ResponseEntity<GameView> start(@Valid @RequestBody StartRequest body, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.start(store(request), body.wonder()));
    }

    @PostMapping("/games/current/turns")
    @Operation(summary = "Jouer un tour", description = "Le joueur joue une carte de sa main, les IA jouent la leur.")
    @ApiResponse(responseCode = "200", description = "Tour suivant")
    @ApiResponse(responseCode = "400", description = "Coup interdit")
    @ApiResponse(responseCode = "404", description = "Aucune partie en cours")
    @ApiResponse(responseCode = "409", description = "Tour expiré ou déjà joué : la partie à jour est renvoyée")
    GameView play(@Valid @RequestBody TurnRequest body, HttpServletRequest request) {
        return service.play(store(request), userId(request), body.card(), body.action(), body.version());
    }

    @PostMapping("/games/current/abandon")
    @Operation(summary = "Abandonner la partie")
    @ApiResponse(responseCode = "204", description = "Partie oubliée", content = @Content)
    ResponseEntity<Void> abandon(HttpServletRequest request) {
        service.abandon(store(request));
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(GameRuleException.class)
    ResponseEntity<ApiError> refused(GameRuleException e) {
        return ResponseEntity.badRequest().body(new ApiError(e.getMessage(), Map.of()));
    }

    @ExceptionHandler(NoGameException.class)
    ResponseEntity<ApiError> noGame(NoGameException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage(), Map.of()));
    }

    @ExceptionHandler(GameConflictException.class)
    ResponseEntity<Conflict> conflict(GameConflictException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new Conflict(e.getMessage(), e.game()));
    }

    /** Partie de l'invité dans sa session, ou partie du compte connecté (tous appareils). */
    private GameStore store(HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        return user == null ? new SessionGameStore(request.getSession(true)) : accounts.forUser(user.id());
    }

    private static String userId(HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        return user == null ? null : user.id();
    }
}
