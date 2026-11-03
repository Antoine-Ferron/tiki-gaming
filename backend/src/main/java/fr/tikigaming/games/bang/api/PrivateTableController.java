package fr.tikigaming.games.bang.api;

import fr.tikigaming.auth.AuthException;
import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import fr.tikigaming.games.bang.engine.PrivateTableService;
import fr.tikigaming.games.bang.model.GameStarted;
import fr.tikigaming.games.bang.model.TableSeat;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/bang/tables")
@Tag(name = "bang", description = "Tables privées BANG! à quatre places, en mémoire, retirées après 1 h sans activité.")
public class PrivateTableController {

    /** Corps JSON du serveur embarqué après un refus CSRF avec Accept: application/json. */
    record CsrfErrorResponse(Instant timestamp, int status, String error, String path) {}

    private final PrivateTableService tables;

    public PrivateTableController(PrivateTableService tables) {
        this.tables = tables;
    }

    @PostMapping
    @Operation(
            summary = "Créer une table privée",
            description = "Le compte connecté occupe la première place. "
                    + "Chaque compte a au plus une table ouverte, dans une limite globale de 1 000 tables. "
                    + "La table et sa donne expirent après 1 h sans création, jonction acceptée ou démarrage accepté. "
                    + "Un démarrage refusé ne renouvelle pas ce délai.")
    @ApiResponse(responseCode = "201", description = "Table créée : code partageable et place du compte connecté")
    @ApiResponse(
            responseCode = "409",
            description = "Ce compte a déjà une table privée ouverte",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "503",
            description = "Le plafond global de tables privées est atteint",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF absent ou invalide",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = CsrfErrorResponse.class)))
    ResponseEntity<TableSeat> create(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tables.create(connectedAccountId(request)));
    }

    @PostMapping("/{code}/join")
    @Operation(
            summary = "Rejoindre une table privée",
            description = "Le code partagé donne une place libre. Un compte déjà assis retrouve sa place, "
                    + "même à table pleine et avec une nouvelle session HTTP. "
                    + "La casse et les espaces autour du code sont ignorés.")
    @ApiResponse(responseCode = "200", description = "Code et place du compte connecté")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF absent ou invalide",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = CsrfErrorResponse.class)))
    @ApiResponse(
            responseCode = "404",
            description = "Code de table inconnu",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description = "Les quatre places sont déjà occupées par d'autres comptes",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    TableSeat join(@PathVariable String code, HttpServletRequest request) {
        return tables.join(code, connectedAccountId(request));
    }

    @PostMapping("/{code}/start")
    @Operation(
            summary = "Démarrer une partie à quatre",
            description = "Tout compte connecté et assis à cette table peut la démarrer. Le Shérif joue en premier. "
                    + "Les demandes suivantes conservent la donne, même simultanées. "
                    + "La réponse contient uniquement le code de table et la place du joueur actif.")
    @ApiResponse(responseCode = "200", description = "Partie démarrée ou déjà en cours")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF absent ou invalide (CsrfErrorResponse), ou compte non assis (ApiError)",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(anyOf = {ApiError.class, CsrfErrorResponse.class})))
    @ApiResponse(
            responseCode = "404",
            description = "Code de table inconnu",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description = "Moins de quatre joueurs assis",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    GameStarted start(@PathVariable String code, HttpServletRequest request) {
        return tables.start(code, connectedAccountId(request));
    }

    private static String connectedAccountId(HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) throw new AuthException(401, "Non connecté");
        return user.id();
    }
}
