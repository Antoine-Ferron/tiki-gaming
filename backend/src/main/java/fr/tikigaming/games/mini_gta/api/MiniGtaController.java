package fr.tikigaming.games.mini_gta.api;

import fr.tikigaming.config.ApiExceptionHandler.ApiError;
import fr.tikigaming.games.mini_gta.missions.MissionDef;
import fr.tikigaming.games.mini_gta.progress.MissionReward;
import fr.tikigaming.games.mini_gta.progress.Progress;
import fr.tikigaming.games.mini_gta.progress.Purchase;
import fr.tikigaming.games.mini_gta.progress.Respawn;
import fr.tikigaming.games.mini_gta.progress.Transactions;
import fr.tikigaming.games.mini_gta.weapons.WeaponId;
import fr.tikigaming.games.mini_gta.world.Vec2;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * API de MiniGTA. Le serveur fait autorité sur la ville, les missions, les armes et les règles d'argent, mais ne
 * stocke rien : la progression du joueur arrive dans le corps des requêtes, et le client sauvegarde celle qui lui
 * est renvoyée (ctx.save). Endpoints publics, jouables en invité.
 */
@RestController
@RequestMapping("/api/games/mini-gta")
@Tag(name = "mini-gta", description = "MiniGTA : ville générée, missions, armes, GPS et transactions sans état.")
public class MiniGtaController {

    private static final String PROGRESS_REQUIRED = "Progression attendue.";
    private static final String WEAPON_IDS = "fists|bat|pistol|rifle|shotgun|sniper|grenade";

    record CompleteRequest(
            @NotNull(message = PROGRESS_REQUIRED) @Valid Progress progress) {}

    record PurchaseRequest(
            @NotNull(message = PROGRESS_REQUIRED) @Valid Progress progress,

            @Schema(
                    example = "weapon",
                    allowableValues = {"weapon", "ammo", "armor"})
            @NotNull(message = "Choisis un article.")
            @Pattern(regexp = "weapon|ammo|armor", message = "Article inconnu.")
            String item,

            @Schema(description = "Arme concernée (absente pour le gilet)", example = "pistol")
            @Pattern(regexp = WEAPON_IDS, message = "Arme inconnue.")
            String weapon) {}

    record RespawnRequest(
            @NotNull(message = PROGRESS_REQUIRED) @Valid Progress progress,

            @Schema(
                    example = "dead",
                    allowableValues = {"dead", "busted"})
            @NotNull(message = "Motif de réapparition attendu.")
            @Pattern(regexp = "dead|busted", message = "Motif de réapparition inconnu.")
            String reason) {}

    private final MiniGtaWorld world;

    public MiniGtaController(MiniGtaWorld world) {
        this.world = world;
    }

    @GetMapping("/world")
    @Operation(
            summary = "Ville",
            description = "Ville générée (graine fixe) : relief, routes, îlots, bâtiments, props, trottoirs et lieux.")
    @ApiResponse(responseCode = "200", description = "Ville au format attendu par cityFromDto (front)")
    Map<String, Object> cityWorld() {
        return world.worldJson();
    }

    @GetMapping("/missions")
    @Operation(summary = "Missions", description = "Catalogue des missions, placées dans la ville.")
    @ApiResponse(responseCode = "200", description = "Missions, dans l'ordre de l'histoire")
    List<Map<String, Object>> missions() {
        return world.missionsJson();
    }

    @GetMapping("/weapons")
    @Operation(summary = "Armes", description = "Caractéristiques et prix des armes, indexés par identifiant.")
    @ApiResponse(responseCode = "200", description = "Armes")
    Map<String, Object> weapons() {
        return Json.weapons();
    }

    @GetMapping("/route")
    @Operation(
            summary = "Itinéraire GPS",
            description = "Route la plus rapide par les rues, terminée par la destination exacte.")
    @ApiResponse(responseCode = "200", description = "Points {x, z} de l'itinéraire")
    @ApiResponse(
            responseCode = "400",
            description = "Coordonnée absente ou invalide",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    List<Vec2> route(
            @Parameter(example = "0") @RequestParam String fromX,
            @Parameter(example = "0") @RequestParam String fromZ,
            @Parameter(example = "200") @RequestParam String toX,
            @Parameter(example = "-150") @RequestParam String toZ) {
        return world.route(coordinate(fromX), coordinate(fromZ), coordinate(toX), coordinate(toZ));
    }

    /** Coordonnée en mètres ; un texte non numérique, NaN ou infini est refusé (400). */
    private static double coordinate(String value) {
        try {
            double d = Double.parseDouble(value);
            if (Double.isFinite(d)) return d;
        } catch (NumberFormatException e) {
            // traité comme une coordonnée invalide ci-dessous
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordonnées invalides.");
    }

    @PostMapping("/missions/{id}/complete")
    @Operation(
            summary = "Mission réussie",
            description = "Paie la récompense (une seule fois par mission) et renvoie la nouvelle progression.")
    @ApiResponse(responseCode = "200", description = "Récompense et progression à sauvegarder")
    @ApiResponse(
            responseCode = "400",
            description = "Progression invalide",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    @ApiResponse(
            responseCode = "404",
            description = "Mission inconnue",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    MissionReward completeMission(
            @Parameter(example = "express") @PathVariable String id, @Valid @RequestBody CompleteRequest body) {
        MissionDef mission = world.mission(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mission inconnue."));
        return Transactions.completeMission(body.progress(), mission);
    }

    @PostMapping("/shop/purchase")
    @Operation(
            summary = "Achat à l'armurerie",
            description = "Arme (deux chargeurs, ou un paquet de grenades), munitions ou gilet. "
                    + "Refusé sans débit si le solde ne couvre pas le prix.")
    @ApiResponse(responseCode = "200", description = "Résultat de l'achat et progression à sauvegarder")
    @ApiResponse(
            responseCode = "400",
            description = "Progression invalide ou article non vendu",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    Purchase purchase(@Valid @RequestBody PurchaseRequest body) {
        Purchase.Item item = Purchase.Item.valueOf(body.item().toUpperCase(Locale.ROOT));
        WeaponId weapon = body.weapon() == null ? null : Json.weaponId(body.weapon());
        if (!Transactions.sells(item, weapon)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet article n'est pas vendu.");
        }
        return Transactions.purchase(body.progress(), item, weapon);
    }

    @PostMapping("/respawn")
    @Operation(
            summary = "Réapparition",
            description = "Frais d'hôpital (10 %, 100 $ minimum) ou caution (15 %, 200 $ minimum). "
                    + "Le solde ne descend jamais sous 0.")
    @ApiResponse(responseCode = "200", description = "Frais prélevés et progression à sauvegarder")
    @ApiResponse(
            responseCode = "400",
            description = "Progression ou motif invalide",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    Respawn respawn(@Valid @RequestBody RespawnRequest body) {
        return Transactions.respawn(
                body.progress(), Respawn.Reason.valueOf(body.reason().toUpperCase(Locale.ROOT)));
    }
}
