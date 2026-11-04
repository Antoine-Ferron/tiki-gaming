package fr.tikigaming.games.dame.matches;

import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Player;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Rencontre locale : les noms désignent les participants, pas des comptes authentifiés. */
public record Match(
        UUID id, String whiteName, String blackName, Instant startedAt, GameStatus status, Instant finishedAt) {

    public static Match start(UUID id, String whiteName, String blackName, Instant at) {
        return new Match(id, whiteName, blackName, at, GameStatus.IN_PROGRESS, null);
    }

    /** Squelette TDD : la clôture sera implémentée après les tests RED. */
    public Match finish(GameStatus result, Instant at) {
        return this;
    }

    public Optional<Player> winner() {
        return Optional.empty();
    }
}
