package fr.tikigaming.games.prismine;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.prismine.Expedition.Verdict;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
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
    static final String RUN_OVER = "Ton expédition est terminée : clique sur « Terminer l'expédition » pour la clore.";

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

    /**
     * Étage en cours d'une expédition, régénéré depuis sa graine. La génération peut retirer jusqu'à 100 grilles : les
     * derniers étages servis sont gardés en cache, une requête n'en paie le coût qu'une fois.
     */
    public static Floors.Floor floorOf(Run run) {
        long key = ((long) run.depth() << 32) | run.seed();
        synchronized (FLOOR_CACHE) {
            return FLOOR_CACHE.computeIfAbsent(key, k -> Floors.generate(run.depth(), run.seed()));
        }
    }

    private static final int FLOOR_CACHE_SIZE = 256;

    /** Cache LRU des étages, indexé par (profondeur, graine). */
    private static final Map<Long, Floors.Floor> FLOOR_CACHE = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<Long, Floors.Floor> eldest) {
            return size() > FLOOR_CACHE_SIZE;
        }
    };

    public Run start(String userId) {
        return start(userId, null);
    }

    /**
     * Commence une expédition. Une seule expédition en cours à la fois : celles du joueur connecté et celle de la
     * session ({@code previousGuestRun}, commencée en invité avant une éventuelle connexion) sont abandonnées.
     */
    public Run start(String userId, UUID previousGuestRun) {
        if (userId != null) runs.deleteByUser(userId);
        if (previousGuestRun != null) {
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
        Run run = active(load(id, userId));
        Run next = Expedition.fire(run, floorOf(run), entry).nextVersion();
        runs.update(next);
        return next;
    }

    /** Supprime les expéditions abandonnées (aucune action depuis {@link #INACTIVE_RUN_TTL}). */
    public void purgeInactiveRuns() {
        runs.deleteInactiveSince(clock.instant().minus(INACTIVE_RUN_TTL));
    }

    public Verdict validate(UUID id, String userId, String guess) {
        Run run = active(load(id, userId));
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
            case Verdict.LampOut lampOut -> {
                // Lampe éteinte : l'expédition est figée (over) avec sa dernière erreur avant toute autre écriture.
                Run ended = lampOut.run().nextVersion();
                runs.update(ended);
                yield new Verdict.LampOut(lampOut.floor(), ended, end(ended));
            }
        };
    }

    /** Le joueur termine son expédition (ou réessaie après une panne) : son score est classé s'il est connecté. */
    public Ending finish(UUID id, String userId) {
        Run run = load(id, userId);
        return new Ending(floorOf(run), run, end(run));
    }

    /** Signale l'expédition à l'audit si l'étage a été trop rapide, une seule fois par expédition. */
    private Run auditPace(Run run, Run next, Duration floorDuration) {
        if (run.audited() || floorDuration.compareTo(Expedition.MIN_FLOOR_DURATION) >= 0) return next;
        audit.floorTooFast(run.id(), run.userId(), run.depth(), floorDuration);
        return next.toBuilder().audited(true).build();
    }

    /**
     * Classe le score (joueur connecté, au moins un étage réussi) puis oublie l'expédition. Peut être rejoué sans
     * risque après une panne : l'expédition est d'abord figée (over), et le registre ignore un score déjà classé.
     */
    private boolean end(Run run) {
        Run ended = run;
        if (!run.over()) {
            // Deux fins envoyées en parallèle : la seconde échoue ici en 409.
            ended = run.toBuilder().over(true).build().nextVersion();
            runs.update(ended);
        }
        boolean ranked = ended.userId() != null && ended.score() > 0;
        if (ranked) {
            long seconds = Duration.between(ended.startedAt(), clock.instant()).toSeconds();
            scores.record(
                    ended.id(),
                    ended.userId(),
                    ended.score(),
                    Map.of(
                            "depth", ended.depth(),
                            "probes", ended.totalProbes(),
                            "errors", ended.totalErrors(),
                            "durationSeconds", seconds));
        }
        runs.delete(ended.id());
        return ranked;
    }

    /** Une expédition terminée n'accepte plus ni tir ni validation : il ne reste qu'à la terminer. */
    private static Run active(Run run) {
        if (run.over()) throw new ApiException(HttpStatus.CONFLICT, RUN_OVER);
        return run;
    }

    /** Une expédition de joueur connecté n'est visible que par lui ; celle d'un invité, par son seul identifiant. */
    private Run load(UUID id, String userId) {
        return runs.find(id)
                .filter(run -> run.userId() == null || Objects.equals(run.userId(), userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, RUN_NOT_FOUND));
    }
}
