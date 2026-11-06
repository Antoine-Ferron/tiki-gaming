package fr.tikigaming.games.prismine;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Expédition en cours, gardée par le serveur : la graine de l'étage (donc sa carte cachée) ne quitte jamais le
 * backend. Pour en dériver une autre, passer par {@link #toBuilder()} plutôt que par le constructeur : ses nombreux
 * {@code int} voisins s'intervertissent sans erreur de compilation.
 *
 * @param userId joueur connecté, ou null pour un invité
 * @param floorErrors validations ratées sur l'étage en cours : la première fait perdre le bonus « sans erreur »
 * @param floorStartedAt début de l'étage en cours, pour l'audit des étages trop rapides
 * @param audited true une fois l'expédition signalée à l'audit (une seule fois par expédition)
 * @param over true une fois l'expédition terminée : son état est figé, il ne reste qu'à classer le score et l'oublier
 * @param version numéro d'écriture : une mise à jour n'est acceptée que sur la version précédente, pour que deux
 *     requêtes simultanées ne s'écrasent pas
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
        boolean audited,
        boolean over,
        long version) {

    /** Un tir du journal. {@code revealed} : tir offert après une validation ratée. */
    public record Probe(int entry, boolean revealed) {}

    public Run {
        probes = List.copyOf(probes);
    }

    Builder toBuilder() {
        return new Builder(this);
    }

    /** Même état, version suivante : à enregistrer à la place de {@code this}. */
    Run nextVersion() {
        return toBuilder().version(version + 1).build();
    }

    Run withOil(int value) {
        return toBuilder().oil(value).build();
    }

    /** Copie modifiable d'une expédition, champ par champ et par nom. */
    static final class Builder {
        private final UUID id;
        private final String userId;
        private final Instant startedAt;
        private int depth;
        private long seed;
        private int oil;
        private int score;
        private int floorErrors;
        private List<Probe> probes;
        private int totalProbes;
        private int totalErrors;
        private Instant floorStartedAt;
        private boolean audited;
        private boolean over;
        private long version;

        private Builder(Run run) {
            id = run.id;
            userId = run.userId;
            startedAt = run.startedAt;
            depth = run.depth;
            seed = run.seed;
            oil = run.oil;
            score = run.score;
            floorErrors = run.floorErrors;
            probes = run.probes;
            totalProbes = run.totalProbes;
            totalErrors = run.totalErrors;
            floorStartedAt = run.floorStartedAt;
            audited = run.audited;
            over = run.over;
            version = run.version;
        }

        Builder depth(int value) {
            depth = value;
            return this;
        }

        Builder seed(long value) {
            seed = value;
            return this;
        }

        Builder oil(int value) {
            oil = value;
            return this;
        }

        Builder score(int value) {
            score = value;
            return this;
        }

        Builder floorErrors(int value) {
            floorErrors = value;
            return this;
        }

        Builder probes(List<Probe> value) {
            probes = value;
            return this;
        }

        Builder totalProbes(int value) {
            totalProbes = value;
            return this;
        }

        Builder totalErrors(int value) {
            totalErrors = value;
            return this;
        }

        Builder floorStartedAt(Instant value) {
            floorStartedAt = value;
            return this;
        }

        Builder audited(boolean value) {
            audited = value;
            return this;
        }

        Builder over(boolean value) {
            over = value;
            return this;
        }

        Builder version(long value) {
            version = value;
            return this;
        }

        Run build() {
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
                    audited,
                    over,
                    version);
        }
    }
}
