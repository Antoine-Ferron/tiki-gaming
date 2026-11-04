package fr.tikigaming.games.sdv_civilisation.api;

import java.util.Optional;

/** Fake : stockage d'une partie en mémoire, avec le même contrôle de version que les vrais stockages. */
class InMemoryGameStore implements GameStore {

    private SavedGame saved;

    @Override
    public Optional<SavedGame> load() {
        return Optional.ofNullable(saved);
    }

    @Override
    public void save(SavedGame game, int expectedVersion) {
        int current = saved == null ? 0 : saved.version();
        if (expectedVersion != 0 && expectedVersion != current) throw new StaleGameException();
        saved = game;
    }

    @Override
    public void clear() {
        saved = null;
    }
}
