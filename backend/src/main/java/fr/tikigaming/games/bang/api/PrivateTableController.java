package fr.tikigaming.games.bang.api;

import fr.tikigaming.auth.AuthException;
import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import fr.tikigaming.games.bang.engine.PrivateTableService;
import fr.tikigaming.games.bang.model.GameStarted;
import fr.tikigaming.games.bang.model.PlayerGameView;
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
import org.springframework.web.bind.annotation.GetMapping;
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
                    + "La table et sa partie expirent après 1 h sans opération acceptée : création, jonction, démarrage, action de tour, tir ou réponse. "
                    + "Les lectures et les actions refusées ne renouvellent pas ce délai.")
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
                    + "La distribution initiale n'inclut pas la pioche de début de tour. "
                    + "Les demandes suivantes conservent la donne et la phase, même simultanées. "
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

    @GetMapping("/{code}/state")
    @Operation(
            summary = "Consulter sa vue de la partie",
            description = "La main et le rôle sont ceux du compte en session. Les rôles secrets des autres joueurs, "
                    + "leurs cartes en main et la pioche ne sont jamais transmis. "
                    + "Le tir en attente (id, shooterSeat, targetSeat) et la main sont retrouvés par une nouvelle session du même compte. "
                    + "La casse et les espaces autour du code sont ignorés. "
                    + "Consulter la partie ne renouvelle pas le délai d'expiration de la table.")
    @ApiResponse(responseCode = "200", description = "Vue privée du joueur connecté et informations publiques")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "404",
            description = "Code de table inconnu ou expiré",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Compte non assis à cette table",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description = "Partie non démarrée",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    PlayerGameView state(@PathVariable String code, HttpServletRequest request) {
        return tables.state(code, connectedAccountId(request));
    }

    @PostMapping("/{code}/turn/draw")
    @Operation(
            summary = "Piocher les deux cartes du début de son tour",
            description = "Seul le joueur actif peut piocher, une fois par tour. "
                    + "Le recyclage de la défausse n'est pas encore pris en charge. "
                    + "La casse et les espaces autour du code sont ignorés. "
                    + "Une action acceptée renouvelle l'activité de la table ; un refus ne la renouvelle pas.")
    @ApiResponse(responseCode = "204", description = "Deux cartes piochées ; la phase de jeu commence")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF invalide ou compte non actif",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(anyOf = {ApiError.class, CsrfErrorResponse.class})))
    @ApiResponse(
            responseCode = "404",
            description = "Table inconnue ou expirée",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description = "Partie non démarrée, mauvaise phase ou pioche insuffisante",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    ResponseEntity<Void> draw(@PathVariable String code, HttpServletRequest request) {
        tables.draw(code, connectedAccountId(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{code}/turn/end")
    @Operation(
            summary = "Terminer sa phase de jeu ou son tour",
            description =
                    "Si la main dépasse les PV actuels, ouvre la défausse ; sinon passe au prochain joueur vivant. "
                            + "La casse et les espaces autour du code sont ignorés. "
                            + "Une action acceptée renouvelle l'activité de la table ; un refus ne la renouvelle pas.")
    @ApiResponse(responseCode = "204", description = "Phase ou tour terminé")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF invalide ou compte non actif",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(anyOf = {ApiError.class, CsrfErrorResponse.class})))
    @ApiResponse(
            responseCode = "404",
            description = "Table inconnue ou expirée",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description = "Partie non démarrée, tir en attente, pioche attendue ou défausse incomplète",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    ResponseEntity<Void> endTurn(@PathVariable String code, HttpServletRequest request) {
        tables.endTurn(code, connectedAccountId(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{code}/turn/discard/{cardId}")
    @Operation(
            summary = "Défausser une carte de sa main par son identifiant",
            description =
                    "Le joueur actif choisit ses cartes en phase de défausse tant que sa main dépasse ses PV actuels, "
                            + "puis termine explicitement son tour. "
                            + "La casse et les espaces autour du code sont ignorés. "
                            + "Une action acceptée renouvelle l'activité de la table ; un refus ne la renouvelle pas.")
    @ApiResponse(responseCode = "204", description = "Carte déplacée de la main vers la défausse")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF invalide ou compte non actif",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(anyOf = {ApiError.class, CsrfErrorResponse.class})))
    @ApiResponse(
            responseCode = "404",
            description = "Table inconnue ou expirée",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description =
                    "Partie non démarrée, mauvaise phase, carte absente de sa main ou limite de main déjà respectée",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    ResponseEntity<Void> discard(@PathVariable String code, @PathVariable String cardId, HttpServletRequest request) {
        tables.discard(code, connectedAccountId(request), cardId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{code}/shots/{cardId}/targets/{targetSeat}")
    @Operation(
            summary = "Tirer sur un joueur",
            description = "Le compte actif en phase PLAY joue une carte autorisée sur une cible vivante à portée. "
                    + "Le tir consomme la carte et crée une unique attente visible via GET state. "
                    + "Le tireur attend la cible avant toute autre action. Le compteur de tirs appartient au tour serveur. "
                    + "La casse et les espaces autour du code sont ignorés. "
                    + "Un tir accepté renouvelle l'activité ; refus et doublons ne la prolongent pas.")
    @ApiResponse(responseCode = "204", description = "Carte défaussée et tir en attente créé")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF invalide, compte extérieur ou non actif",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(anyOf = {ApiError.class, CsrfErrorResponse.class})))
    @ApiResponse(
            responseCode = "404",
            description = "Table inconnue ou expirée",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description =
                    "Partie non démarrée, mauvaise phase, tir déjà en attente, limite de tirs atteinte, carte indisponible ou cible invalide/hors portée ; aucun effet",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    ResponseEntity<Void> fire(
            @PathVariable String code,
            @PathVariable String cardId,
            @PathVariable int targetSeat,
            HttpServletRequest request) {
        tables.fire(code, connectedAccountId(request), cardId, targetSeat);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{code}/shots/{shotId}/dodge/{cardId}")
    @Operation(
            summary = "Esquiver le tir en attente",
            description =
                    "Seul le compte cible en session peut répondre au tir identifié par shotId, "
                            + "même si le tireur reste actif. La carte doit être une esquive autorisée par son personnage. "
                            + "Les PV sont conservés, la carte est défaussée et l'attente est supprimée. "
                            + "Une réponse ancienne ne résout jamais un nouveau tir. Consulter GET state pour reprendre après reconnexion. "
                            + "La casse et les espaces autour du code sont ignorés. Seule une réponse acceptée renouvelle l'activité.")
    @ApiResponse(responseCode = "204", description = "Tir esquivé ; le tireur reprend son tour")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF invalide, compte extérieur ou compte différent de la cible",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(anyOf = {ApiError.class, CsrfErrorResponse.class})))
    @ApiResponse(
            responseCode = "404",
            description = "Table inconnue ou expirée",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description =
                    "Partie non démarrée, tir absent/périmé/déjà résolu, ou carte indisponible/non autorisée ; aucun effet",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    ResponseEntity<Void> dodge(
            @PathVariable String code,
            @PathVariable String shotId,
            @PathVariable String cardId,
            HttpServletRequest request) {
        tables.respond(code, connectedAccountId(request), shotId, cardId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{code}/shots/{shotId}/accept")
    @Operation(
            summary = "Accepter le tir en attente",
            description =
                    "Seul le compte cible en session peut accepter le tir identifié par shotId. "
                            + "Les règles appliquent la perte de 1 PV, puis l'attente est supprimée et le tireur reprend son tour. "
                            + "Une réponse répétée ou retardée ne rejoue aucun effet et ne résout jamais un nouveau tir. "
                            + "Le bonus de pioche de Bart Cassidy n'est pas encore raccordé. "
                            + "La casse et les espaces autour du code sont ignorés. Seule une réponse acceptée renouvelle l'activité.")
    @ApiResponse(responseCode = "204", description = "Tir accepté et dégâts appliqués une fois")
    @ApiResponse(
            responseCode = "401",
            description = "Non connecté",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Jeton CSRF invalide, compte extérieur ou compte différent de la cible",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(anyOf = {ApiError.class, CsrfErrorResponse.class})))
    @ApiResponse(
            responseCode = "404",
            description = "Table inconnue ou expirée",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "409",
            description = "Partie non démarrée ou tir absent/périmé/déjà résolu ; aucun effet",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    ResponseEntity<Void> accept(@PathVariable String code, @PathVariable String shotId, HttpServletRequest request) {
        tables.respond(code, connectedAccountId(request), shotId, null);
        return ResponseEntity.noContent().build();
    }

    private static String connectedAccountId(HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) throw new AuthException(401, "Non connecté");
        return user.id();
    }
}
