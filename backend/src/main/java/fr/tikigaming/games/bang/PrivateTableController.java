package fr.tikigaming.games.bang;

import fr.tikigaming.auth.AuthException;
import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/bang/tables")
@Tag(
        name = "bang",
        description = "Tables privées BANG! à quatre places, conservées en mémoire pendant cette exécution.")
public class PrivateTableController {

    private final PrivateTableService tables;

    public PrivateTableController(PrivateTableService tables) {
        this.tables = tables;
    }

    @PostMapping
    @Operation(summary = "Créer une table privée", description = "Le compte connecté occupe la première place.")
    @ApiResponse(responseCode = "201", description = "Table créée : code partageable et place du compte connecté")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(responseCode = "403", description = "Jeton CSRF absent ou invalide", content = @Content)
    ResponseEntity<TableSeat> create(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tables.create(connectedAccountId(request)));
    }

    @PostMapping("/{code}/join")
    @Operation(
            summary = "Rejoindre une table privée",
            description = "Le code partagé donne une place libre. Un compte déjà assis retrouve sa place, "
                    + "même à table pleine et avec une nouvelle session HTTP.")
    @ApiResponse(responseCode = "200", description = "Code et place du compte connecté")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(responseCode = "403", description = "Jeton CSRF absent ou invalide", content = @Content)
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

    private static String connectedAccountId(HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) throw new AuthException(401, "Non connecté");
        return user.id();
    }
}
