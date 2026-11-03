package fr.tikigaming.games.prismine;

import fr.tikigaming.games.GameException;
import fr.tikigaming.games.prismine.Expedition.Verdict;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Serveur arbitre de Prismine : la carte cachée reste ici, le joueur n'envoie que ses tirs et sa carte. Ne dépend que
 * de contrats (registres, audit, hasard, horloge) : voir PrismineConfig pour les implémentations de production.
 */
public class PrismineService {

    static final String RUN_NOT_FOUND = "Cette expédition n'existe plus : commences-en une nouvelle.";

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
        Run run = Expedition.start(UUID.randomUUID(), userId, seeds.nextSeed(), clock.instant());
        runs.save(run);
        return run;
    }

    public Run get(UUID id, String userId) {
        return load(id, userId);
    }

    public Run probe(UUID id, String userId, int entry) {
        Run run = load(id, userId);
        Run next = Expedition.fire(run, floorOf(run), entry);
        runs.save(next);
        return next;
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
                runs.save(wrong.next());
                yield wrong;
            }
            case Verdict.Cleared cleared -> {
                Run next = auditPace(run, cleared.next(), Duration.between(run.floorStartedAt(), now));
                runs.save(next);
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
                .orElseThrow(() -> new GameException(404, RUN_NOT_FOUND));
    }
}
