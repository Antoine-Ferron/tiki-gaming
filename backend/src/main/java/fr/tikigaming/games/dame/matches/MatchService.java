package fr.tikigaming.games.dame.matches;

import fr.tikigaming.games.dame.Game;
import java.time.Clock;
import java.util.UUID;
import java.util.function.Supplier;

/** Cas d'usage indépendants des I/O ; l'horloge et les identifiants sont injectés. */
public final class MatchService {

    private final MatchRepository repository;
    private final Clock clock;
    private final Supplier<UUID> ids;

    public MatchService(MatchRepository repository, Clock clock, Supplier<UUID> ids) {
        this.repository = repository;
        this.clock = clock;
        this.ids = ids;
    }

    /** Squelette TDD : création après les tests RED. */
    public Match start(String whiteName, String blackName) {
        return null;
    }

    public Match find(UUID id) {
        return null;
    }

    /** Le jeu doit être celui de la rencontre, détenu par le serveur ; aucun gagnant fourni par le client. */
    public Match finish(UUID id, Game game) {
        return null;
    }
}
