package fr.tikigaming.games.prismine;

import com.fasterxml.jackson.annotation.JsonInclude;
import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.prismine.Expedition.ProbeResult;
import fr.tikigaming.games.prismine.Expedition.Verdict;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/prismine/runs")
@Tag(
        name = "prismine",
        description = "Serveur arbitre de Prismine : la carte cachée reste sur le serveur, "
                + "le joueur envoie ses tirs et sa carte. Jouable en invité.")
public class PrismineController {

    record ProbeRequest(
            @Schema(description = "Entrée sur le bord, numérotée dans le sens horaire depuis Haut A", example = "3")
            @NotNull(message = "Choisis un bord de la galerie.")
            Integer entry) {}

    record GuessRequest(
            @Schema(
                    description = "Carte du joueur, ligne par ligne : . vide, # obsidienne, a à l prisme",
                    example = "....................................")
            @NotNull(message = "Envoie ta carte.")
            @Pattern(regexp = "^[.#a-l]*$", message = "La carte contient une pièce inconnue.")
            String guess) {}

    record ProbeView(
            int entry,
            boolean revealed,

            @Schema(description = "Entrée de sortie, null si le faisceau est absorbé", nullable = true)
            Integer exit,

            int bounces,

            @Schema(description = "Mélange des couleurs : rouge = 1, vert = 2, bleu = 4, 0 = blanc")
            int color) {}

    /** Expédition vue par le joueur : jamais la graine ni la carte cachée. */
    record RunView(
            UUID id,
            int depth,
            int size,
            int prisms,
            int obsidians,
            List<Integer> colors,
            int oil,
            int score,
            int floorErrors,
            int totalProbes,
            int totalErrors,
            List<ProbeView> probes) {}

    /** Étage terminé : sa carte est dévoilée. */
    record FloorView(
            int depth,
            int size,
            int prisms,
            int obsidians,
            List<Integer> colors,
            String grid,
            List<ProbeView> probes) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record VerdictView(
            @Schema(allowableValues = {"contradiction", "wrong", "cleared", "lamp-out"})
            String kind,

            @Schema(description = "contradiction : indices des tirs que la carte n'explique pas")
            List<Integer> contradictions,

            @Schema(description = "wrong : entrée du tir révélé")
            Integer entry,

            @Schema(description = "cleared : points gagnés") Integer points,

            @Schema(description = "cleared : étage réussi sans erreur")
            Boolean perfect,

            @Schema(description = "cleared, lamp-out : étage terminé, carte dévoilée")
            FloorView floor,

            @Schema(description = "Expédition après la validation (finale pour lamp-out)")
            RunView run,

            @Schema(description = "lamp-out : score classé") Boolean recorded) {}

    record EndView(FloorView floor, RunView run, boolean recorded) {}

    /** Attribut de session : expédition en cours d'un invité, abandonnée s'il en commence une autre. */
    static final String GUEST_RUN = "prismine.guest-run";

    private final PrismineService service;
    private final StartLimiter limiter;

    public PrismineController(PrismineService service, StartLimiter limiter) {
        this.service = service;
        this.limiter = limiter;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Commencer une expédition",
            description = "Étage 1, lampe pleine. Une seule expédition en cours par compte, ou par session pour "
                    + "un invité : la précédente est abandonnée.")
    @ApiResponse(responseCode = "201", description = "Expédition créée")
    @ApiResponse(responseCode = "429", description = "Trop d'expéditions commencées depuis cette adresse")
    RunView start(HttpServletRequest request) {
        limiter.acquire(request.getRemoteAddr());
        String userId = userId(request);
        HttpSession session = request.getSession(userId == null);
        // Expédition commencée en invité dans cette session, éventuellement avant une connexion : abandonnée aussi.
        UUID previous = session != null && session.getAttribute(GUEST_RUN) instanceof UUID id ? id : null;
        Run run = service.start(userId, previous);
        if (userId == null) {
            session.setAttribute(GUEST_RUN, run.id());
        } else if (session != null) {
            session.removeAttribute(GUEST_RUN);
        }
        return view(run);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Reprendre une expédition", description = "État de l'expédition et journal des tirs.")
    @ApiResponse(responseCode = "200", description = "Expédition en cours")
    @ApiResponse(responseCode = "404", description = "Expédition terminée, inconnue ou d'un autre joueur")
    RunView get(@PathVariable String id, HttpServletRequest request) {
        return view(service.get(runId(id), userId(request)));
    }

    @PostMapping("/{id}/probes")
    @Operation(summary = "Envoyer un faisceau", description = "Coûte une dose d'huile.")
    @ApiResponse(responseCode = "200", description = "Tir ajouté au journal")
    @ApiResponse(responseCode = "400", description = "Entrée manquante ou hors de la galerie")
    @ApiResponse(responseCode = "404", description = "Expédition introuvable")
    @ApiResponse(responseCode = "409", description = "Bord déjà exploré ou lampe vide")
    RunView probe(@PathVariable String id, @Valid @RequestBody ProbeRequest body, HttpServletRequest request) {
        return view(service.probe(runId(id), userId(request), body.entry()));
    }

    @PostMapping("/{id}/validation")
    @Operation(
            summary = "Valider sa carte",
            description = "Juste : étage suivant. Fausse : un tir est révélé contre de l'huile, "
                    + "ou la lampe s'éteint et l'expédition se termine.")
    @ApiResponse(responseCode = "200", description = "Verdict")
    @ApiResponse(responseCode = "400", description = "Carte illisible ou de mauvaise taille")
    @ApiResponse(responseCode = "404", description = "Expédition introuvable")
    @ApiResponse(responseCode = "502", description = "Score impossible à enregistrer")
    VerdictView validate(@PathVariable String id, @Valid @RequestBody GuessRequest body, HttpServletRequest request) {
        return switch (service.validate(runId(id), userId(request), body.guess())) {
            case Verdict.Contradiction c ->
                new VerdictView("contradiction", c.probes(), null, null, null, null, null, null);
            case Verdict.Wrong w -> new VerdictView("wrong", null, w.entry(), null, null, null, view(w.next()), null);
            case Verdict.Cleared c ->
                new VerdictView(
                        "cleared",
                        null,
                        null,
                        c.points(),
                        c.perfect(),
                        floorView(c.floor(), c.probes()),
                        view(c.next()),
                        null);
            case Verdict.LampOut l ->
                new VerdictView(
                        "lamp-out",
                        null,
                        null,
                        null,
                        null,
                        floorView(l.floor(), l.run().probes()),
                        view(l.run()),
                        l.recorded());
        };
    }

    @PostMapping("/{id}/end")
    @Operation(
            summary = "Terminer l'expédition",
            description = "Dévoile l'étage en cours et classe le score d'un joueur connecté.")
    @ApiResponse(responseCode = "200", description = "Expédition terminée")
    @ApiResponse(responseCode = "404", description = "Expédition introuvable")
    @ApiResponse(responseCode = "502", description = "Score impossible à enregistrer")
    EndView end(@PathVariable String id, HttpServletRequest request) {
        PrismineService.Ending ending = service.finish(runId(id), userId(request));
        return new EndView(floorView(ending.floor(), ending.run().probes()), view(ending.run()), ending.recorded());
    }

    private static String userId(HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        return user == null ? null : user.id();
    }

    private static UUID runId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.NOT_FOUND, PrismineService.RUN_NOT_FOUND);
        }
    }

    private static RunView view(Run run) {
        Floors.Floor floor = PrismineService.floorOf(run);
        // Spécification de l'étage réellement généré : son décompte de pièces fait foi.
        Floors.Spec spec = floor.spec();
        return new RunView(
                run.id(),
                run.depth(),
                spec.size(),
                spec.prisms(),
                spec.obsidians(),
                spec.colors(),
                run.oil(),
                run.score(),
                run.floorErrors(),
                run.totalProbes(),
                run.totalErrors(),
                probeViews(Expedition.results(run.probes(), floor)));
    }

    private static FloorView floorView(Floors.Floor floor, List<Run.Probe> probes) {
        Floors.Spec spec = floor.spec();
        return new FloorView(
                floor.depth(),
                spec.size(),
                spec.prisms(),
                spec.obsidians(),
                spec.colors(),
                floor.grid(),
                probeViews(Expedition.results(probes, floor)));
    }

    private static List<ProbeView> probeViews(List<ProbeResult> results) {
        return results.stream()
                .map(r -> new ProbeView(
                        r.entry(),
                        r.revealed(),
                        r.outcome().exit(),
                        r.outcome().bounces(),
                        r.outcome().color()))
                .toList();
    }
}
