package fr.tikigaming.games.dame.matches;

import java.util.Optional;
import java.util.UUID;

/** Port atomique : plateau, version et résultat sont écrits dans une seule transaction. */
public interface GameSaveRepository {
    Optional<GameSave> findOwned(UUID id, String ownerHash);

    /** Version zéro : création. Sinon, exige la version précédente et une partie encore en cours. */
    void save(GameSave save);
}
