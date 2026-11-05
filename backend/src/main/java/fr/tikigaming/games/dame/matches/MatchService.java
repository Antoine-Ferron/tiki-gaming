package fr.tikigaming.games.dame.matches;

import fr.tikigaming.games.dame.Game;
import java.time.Clock;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;

/** Cas d'usage indépendants des I/O ; l'horloge et les identifiants sont injectés. */
public final class MatchService {

    private final MatchRepository repository;
    private final Clock clock;
    private final Supplier<UUID> ids;

    public MatchService(MatchRepository repository, Clock clock, Supplier<UUID> ids) {
        this.repository = Objects.requireNonNull(repository);
        this.clock = Objects.requireNonNull(clock);
        this.ids = Objects.requireNonNull(ids);
    }

    public Match start(String whiteName, String blackName) {
        Match match = Match.start(ids.get(), whiteName, blackName, clock.instant());
        repository.save(match);
        return match;
    }

    public Match find(UUID id) {
        return repository
                .findById(Objects.requireNonNull(id, "L'identifiant de rencontre est requis."))
                .orElseThrow(() -> new NoSuchElementException("Rencontre introuvable."));
    }

    /** Le jeu doit être celui de la rencontre, détenu par le serveur ; aucun gagnant fourni par le client. */
    public Match finish(UUID id, Game game) {
        Objects.requireNonNull(game, "La partie est requise.");
        Match finished = find(id).finish(game.status(), clock.instant());
        repository.save(finished);
        return finished;
    }
}
