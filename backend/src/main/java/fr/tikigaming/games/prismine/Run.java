package fr.tikigaming.games.prismine;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Expédition en cours, gardée par le serveur : la graine de l'étage (donc sa carte cachée) ne quitte jamais le
 * backend.
 *
 * @param userId joueur connecté, ou null pour un invité
 * @param floorErrors validations ratées sur l'étage en cours : la première fait perdre le bonus « sans erreur »
 * @param floorStartedAt début de l'étage en cours, pour l'audit des étages trop rapides
 * @param audited true une fois l'expédition signalée à l'audit (une seule fois par expédition)
 */
public record Run(
        UUID id,
        String userId,
        int depth,
        long seed,
        int oil,
        int score,
        int floorErrors,
        List<Probe> probes,
        int totalProbes,
        int totalErrors,
        Instant startedAt,
        Instant floorStartedAt,
        boolean audited) {

    /** Un tir du journal. {@code revealed} : tir offert après une validation ratée. */
    public record Probe(int entry, boolean revealed) {}

    public Run {
        probes = List.copyOf(probes);
    }

    @JsonIgnore
    public Floors.Spec spec() {
        return Floors.spec(depth);
    }

    public Run withOil(int value) {
        return new Run(
                id,
                userId,
                depth,
                seed,
                value,
                score,
                floorErrors,
                probes,
                totalProbes,
                totalErrors,
                startedAt,
                floorStartedAt,
                audited);
    }

    Run withAudited() {
        return new Run(
                id,
                userId,
                depth,
                seed,
                oil,
                score,
                floorErrors,
                probes,
                totalProbes,
                totalErrors,
                startedAt,
                floorStartedAt,
                true);
    }
}
