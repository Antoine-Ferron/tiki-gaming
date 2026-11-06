package fr.tikigaming.games.dame.api;

import fr.tikigaming.games.dame.DrawState;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.matches.GameSave;
import fr.tikigaming.games.dame.matches.GameSaveRepository;
import fr.tikigaming.games.dame.matches.Match;
import fr.tikigaming.games.dame.matches.MatchRepository;
import fr.tikigaming.games.dame.persistence.MatchStorageException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Fake de stockage avec deux pannes distinctes : refus avant écriture et réponse perdue après écriture. */
final class ApiMatches implements MatchRepository, GameSaveRepository {
    final Map<UUID, Match> rows = new ConcurrentHashMap<>();
    final Map<UUID, GameSave> saves = new ConcurrentHashMap<>();
    int reads;
    int writes;
    boolean failBeforeWrite;
    boolean failAfterWrite;

    @Override
    public Optional<GameSave> findOwned(UUID id, String ownerHash) {
        reads++;
        GameSave save = saves.get(id);
        if (save == null || !save.ownerHash().equals(ownerHash) || !rows.containsKey(id)) return Optional.empty();
        return Optional.of(new GameSave(rows.get(id), ownerHash, save.version(), save.state()));
    }

    @Override
    public synchronized void save(GameSave save) {
        UUID id = save.match().id();
        GameSave previous = saves.get(id);
        if (previous != null
                && (previous.version() + 1 != save.version()
                        || !previous.ownerHash().equals(save.ownerHash())
                        || rows.get(id).status() != GameStatus.IN_PROGRESS)) {
            throw new IllegalStateException("Version périmée");
        }
        writes++;
        if (failBeforeWrite) throw outage();
        saves.put(id, save);
        rows.put(id, save.match());
        if (failAfterWrite) throw outage();
    }

    void fixture(DameGameView view, DrawState history) {
        GameSave previous = saves.get(view.id());
        String state = tools.jackson.databind.json.JsonMapper.builder()
                .build()
                .writeValueAsString(new DameApplicationService.State(view, history));
        saves.put(view.id(), new GameSave(previous.match(), previous.ownerHash(), view.version(), state));
    }

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
        saves.clear();
        reads = 0;
        writes = 0;
        failBeforeWrite = false;
        failAfterWrite = false;
    }
}
