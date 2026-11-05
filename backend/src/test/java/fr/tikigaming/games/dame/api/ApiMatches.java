package fr.tikigaming.games.dame.api;

import fr.tikigaming.games.dame.matches.Match;
import fr.tikigaming.games.dame.matches.MatchRepository;
import fr.tikigaming.games.dame.persistence.MatchStorageException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Fake de stockage avec deux pannes distinctes : refus avant écriture et réponse perdue après écriture. */
final class ApiMatches implements MatchRepository {
    final Map<UUID, Match> rows = new ConcurrentHashMap<>();
    int reads;
    int writes;
    boolean failBeforeWrite;
    boolean failAfterWrite;

    @Override
    public Optional<Match> findById(UUID id) {
        reads++;
        return Optional.ofNullable(rows.get(id));
    }

    @Override
    public void save(Match match) {
        writes++;
        if (failBeforeWrite) throw outage();
        rows.put(match.id(), match);
        if (failAfterWrite) throw outage();
    }

    private static MatchStorageException outage() {
        return new MatchStorageException(new IllegalStateException("Panne simulée du fournisseur"));
    }

    void clear() {
        rows.clear();
        reads = 0;
        writes = 0;
        failBeforeWrite = false;
        failAfterWrite = false;
    }
}
