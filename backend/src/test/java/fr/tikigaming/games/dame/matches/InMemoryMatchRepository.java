package fr.tikigaming.games.dame.matches;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Fake fonctionnel pour les tests de cas d'usage ; ne valide aucune propriété de PostgreSQL. */
final class InMemoryMatchRepository implements MatchRepository {

    private final Map<UUID, Match> matches = new HashMap<>();

    @Override
    public Optional<Match> findById(UUID id) {
        return Optional.ofNullable(matches.get(id));
    }

    @Override
    public void save(Match match) {
        matches.put(match.id(), match);
    }
}
