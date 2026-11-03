package fr.tikigaming.games.prismine;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.prismine.Expedition.Verdict;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/**
 * Serveur arbitre de Prismine : la carte cachée reste ici, le joueur n'envoie que ses tirs et sa carte. Ne dépend que
 * de contrats (registres, audit, hasard, horloge) : voir PrismineConfig pour les implémentations de production.
 */
public class PrismineService {

    static final String RUN_NOT_FOUND = "Cette expédition n'existe plus : commences-en une nouvelle.";

    /** Une expédition sans aucune action pendant ce délai est abandonnée : la purge la supprime. */
    public static final Duration INACTIVE_RUN_TTL = Duration.ofHours(24);

    /** Fin d'expédition : dernier étage (carte dévoilée), état final, et score classé ou non. */
    public record Ending(Floors.Floor floor, Run run, boolean recorded) {}

    private final RunRepository runs;
    private final ScoreRegistry scores;
    private final AuditNotifier audit;
    private final SeedSource seeds;
    private final Clock clock;

    public PrismineService(
            RunRepository runs, ScoreRegistry scores, AuditNotifier audit, SeedSource seeds, Clock clock) {
        this.runs = runs;
        this.scores = scores;
        this.audit = audit;
        this.seeds = seeds;
        this.clock = clock;
    }

    /** Étage en cours d'une expédition, régénéré depuis sa graine. */
    public static Floors.Floor floorOf(Run run) {
        return Floors.generate(run.depth(), run.seed());
    }

    public Run start(String userId) {
        return start(userId, null);
    }

    /**
     * Commence une expédition. Une seule expédition en cours à la fois : celles du joueur connecté, ou celle de la
     * session d'un invité ({@code previousGuestRun}), sont abandonnées.
     */
    public Run start(String userId, UUID previousGuestRun) {
        if (userId != null) {
            runs.deleteByUser(userId);
        } else if (previousGuestRun != null) {
            runs.find(previousGuestRun)
                    .filter(previous -> previous.userId() == null)
                    .ifPresent(previous -> runs.delete(previous.id()));
        }
        Run run = Expedition.start(UUID.randomUUID(), userId, seeds.nextSeed(), clock.instant());
        runs.insert(run);
        return run;
    }

    public Run get(UUID id, String userId) {
        return load(id, userId);
    }

    public Run probe(UUID id, String userId, int entry) {
        Run run = load(id, userId);
        Run next = Expedition.fire(run, floorOf(run), entry).nextVersion();
        runs.update(next);
        return next;
    }

    /** Supprime les expéditions abandonnées (aucune action depuis {@link #INACTIVE_RUN_TTL}). */
    public void purgeInactiveRuns() {
        runs.deleteInactiveSince(clock.instant().minus(INACTIVE_RUN_TTL));
    }

    public Verdict validate(UUID id, String userId, String guess) {
        Run run = load(id, userId);
        Instant now = clock.instant();
        // Un seul tirage : graine de l'étage suivant si la carte est juste, choix du tir révélé sinon.
        long draw = seeds.nextSeed();
        Verdict verdict = Expedition.validate(run, floorOf(run), guess, draw, draw, now);
        return switch (verdict) {
            case Verdict.Contradiction contradiction -> contradiction;
            case Verdict.Wrong wrong -> {
                Run next = wrong.next().nextVersion();
                runs.update(next);
                yield new Verdict.Wrong(wrong.entry(), next);
            }
            case Verdict.Cleared cleared -> {
                Run next = auditPace(run, cleared.next(), Duration.between(run.floorStartedAt(), now))
                        .nextVersion();
                runs.update(next);
                yield new Verdict.Cleared(cleared.points(), cleared.perfect(), cleared.floor(), cleared.probes(), next);
            }
            case Verdict.LampOut lampOut -> new Verdict.LampOut(lampOut.floor(), lampOut.run(), end(lampOut.run()));
        };
    }

    /** Le joueur termine son expédition : son score est classé s'il est connecté. */
    public Ending finish(UUID id, String userId) {
        Run run = load(id, userId);
        return new Ending(floorOf(run), run, end(run));
    }

    /** Signale l'expédition à l'audit si l'étage a été trop rapide, une seule fois par expédition. */
    private Run auditPace(Run run, Run next, Duration floorDuration) {
        if (run.audited() || floorDuration.compareTo(Expedition.MIN_FLOOR_DURATION) >= 0) return next;
        audit.floorTooFast(run.id(), run.userId(), run.depth(), floorDuration);
        return next.withAudited();
    }

    /** Classe le score (joueur connecté, au moins un étage réussi) puis oublie l'expédition. */
    private boolean end(Run run) {
        // Réserve l'expédition avant de classer : une fin envoyée deux fois en parallèle échoue en 409 au lieu
        // d'enregistrer le score deux fois.
        runs.update(run.nextVersion());
        boolean ranked = run.userId() != null && run.score() > 0;
        if (ranked) {
            long seconds = Duration.between(run.startedAt(), clock.instant()).toSeconds();
            scores.record(
                    run.userId(),
                    run.score(),
                    Map.of(
                            "depth", run.depth(),
                            "probes", run.totalProbes(),
                            "errors", run.totalErrors(),
                            "durationSeconds", seconds));
        }
        // Après l'enregistrement : si Supabase échoue, l'expédition reste et le joueur peut réessayer.
        runs.delete(run.id());
        return ranked;
    }

    /** Une expédition de joueur connecté n'est visible que par lui ; celle d'un invité, par son seul identifiant. */
    private Run load(UUID id, String userId) {
        return runs.find(id)
                .filter(run -> run.userId() == null || Objects.equals(run.userId(), userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, RUN_NOT_FOUND));
    }
}
