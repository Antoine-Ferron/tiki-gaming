package fr.tikigaming.games.prismine;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.prismine.Engine.Outcome;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/**
 * Règles d'une expédition : huile de lampe, tirs, validation de la carte et score. Fonctions pures : l'heure et le
 * hasard sont passés en paramètres, le service décide quand enregistrer.
 */
public final class Expedition {

    public static final int START_OIL = 20;
    public static final int PROBE_COST = 1;
    public static final int ERROR_COST = 3;
    public static final int FLOOR_REFILL = 10;

    /** En dessous, un étage validé est signalé à l'audit (anti-triche). */
    public static final Duration MIN_FLOOR_DURATION = Duration.ofSeconds(5);

    static final String ALREADY_KNOWN = "Ce bord a déjà été exploré : regarde le journal.";
    static final String LAMP_EMPTY = "Ta lampe est vide : valide ta carte ou termine l'expédition.";
    static final String UNKNOWN_ENTRY = "Ce bord n'existe pas dans cette galerie.";
    static final String WRONG_SIZE = "La carte ne correspond pas à la taille de la galerie.";

    public record ProbeResult(int entry, boolean revealed, Outcome outcome) {}

    /** Verdict d'une validation de carte. */
    public sealed interface Verdict {

        /** La carte contredit des tirs déjà faits (indices dans le journal) : rien n'est décompté. */
        record Contradiction(List<Integer> probes) implements Verdict {}

        /** Étage réussi : {@code floor} et {@code probes} décrivent l'étage terminé, {@code next} le suivant. */
        record Cleared(int points, boolean perfect, Floors.Floor floor, List<Run.Probe> probes, Run next)
                implements Verdict {}

        /** Carte fausse : l'entrée révélée est ajoutée au journal. */
        record Wrong(int entry, Run next) implements Verdict {}

        /** Plus assez d'huile pour payer l'erreur : fin de l'expédition ({@code recorded} : score classé). */
        record LampOut(Floors.Floor floor, Run run, boolean recorded) implements Verdict {}
    }

    private Expedition() {}

    /** Points d'un étage réussi : 100 × profondeur, +50 % sans validation ratée. */
    public static int floorPoints(int depth, boolean perfect) {
        return 100 * depth + (perfect ? 50 * depth : 0);
    }

    public static Run start(UUID id, String userId, long seed, Instant now) {
        return new Run(id, userId, 1, seed, START_OIL, 0, 0, List.of(), 0, 0, now, now, false, 0);
    }

    public static List<ProbeResult> results(List<Run.Probe> probes, Floors.Floor floor) {
        return probes.stream()
                .map(p -> new ProbeResult(
                        p.entry(),
                        p.revealed(),
                        Engine.trace(floor.grid(), floor.spec().size(), p.entry())))
                .toList();
    }

    /** Entrées déjà connues : départ ou sortie d'un tir du journal. */
    static Set<Integer> knownEntries(List<Run.Probe> probes, Floors.Floor floor) {
        Set<Integer> known = new HashSet<>();
        for (ProbeResult result : results(probes, floor)) {
            known.add(result.entry());
            if (result.outcome().exit() != null) known.add(result.outcome().exit());
        }
        return known;
    }

    public static Run fire(Run run, Floors.Floor floor, int entry) {
        if (entry < 0 || entry >= Engine.entryCount(floor.spec().size())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, UNKNOWN_ENTRY);
        }
        if (knownEntries(run.probes(), floor).contains(entry)) {
            throw new ApiException(HttpStatus.CONFLICT, ALREADY_KNOWN);
        }
        if (run.oil() < PROBE_COST) throw new ApiException(HttpStatus.CONFLICT, LAMP_EMPTY);
        List<Run.Probe> probes = new ArrayList<>(run.probes());
        probes.add(new Run.Probe(entry, false));
        return new Run(
                run.id(),
                run.userId(),
                run.depth(),
                run.seed(),
                run.oil() - PROBE_COST,
                run.score(),
                run.floorErrors(),
                probes,
                run.totalProbes() + 1,
                run.totalErrors(),
                run.startedAt(),
                run.floorStartedAt(),
                run.audited(),
                run.version());
    }

    /**
     * Valide la carte du joueur. Elle est juste si chaque entrée de la galerie donne le même résultat que sur la vraie
     * carte : deux cartes indiscernables par la lumière sont donc toutes les deux justes.
     *
     * @param nextSeed graine de l'étage suivant, si celui-ci est réussi
     * @param randomness choisit le tir révélé si la carte est fausse
     * @param now début de l'étage suivant
     */
    public static Verdict validate(
            Run run, Floors.Floor floor, String guess, long nextSeed, long randomness, Instant now) {
        int size = floor.spec().size();
        if (!Engine.isValidGrid(guess, size)) throw new ApiException(HttpStatus.BAD_REQUEST, WRONG_SIZE);

        List<Integer> contradicted = new ArrayList<>();
        List<ProbeResult> results = results(run.probes(), floor);
        for (int i = 0; i < results.size(); i++) {
            if (!results.get(i)
                    .outcome()
                    .equals(Engine.trace(guess, size, results.get(i).entry()))) {
                contradicted.add(i);
            }
        }
        if (!contradicted.isEmpty()) return new Verdict.Contradiction(contradicted);

        List<Integer> differing = Engine.differingEntries(floor.grid(), guess, size);
        if (differing.isEmpty()) {
            boolean perfect = run.floorErrors() == 0;
            int points = floorPoints(run.depth(), perfect);
            Run next = new Run(
                    run.id(),
                    run.userId(),
                    run.depth() + 1,
                    nextSeed,
                    run.oil() + FLOOR_REFILL,
                    run.score() + points,
                    0,
                    List.of(),
                    run.totalProbes(),
                    run.totalErrors(),
                    run.startedAt(),
                    now,
                    run.audited(),
                    run.version());
            return new Verdict.Cleared(points, perfect, floor, run.probes(), next);
        }

        Run charged = withError(run, run.probes(), 0);
        if (run.oil() < ERROR_COST) return new Verdict.LampOut(floor, charged, false);
        int entry = differing.get((int) Long.remainderUnsigned(randomness, differing.size()));
        List<Run.Probe> probes = new ArrayList<>(run.probes());
        probes.add(new Run.Probe(entry, true));
        return new Verdict.Wrong(entry, withError(run, probes, ERROR_COST));
    }

    private static Run withError(Run run, List<Run.Probe> probes, int cost) {
        return new Run(
                run.id(),
                run.userId(),
                run.depth(),
                run.seed(),
                run.oil() - cost,
                run.score(),
                run.floorErrors() + (cost > 0 ? 1 : 0),
                probes,
                run.totalProbes(),
                run.totalErrors() + 1,
                run.startedAt(),
                run.floorStartedAt(),
                run.audited(),
                run.version());
    }
}
