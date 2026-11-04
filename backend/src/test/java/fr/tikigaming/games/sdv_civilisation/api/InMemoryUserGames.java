package fr.tikigaming.games.sdv_civilisation.api;

import java.util.HashMap;
import java.util.Map;

/** Fake : les parties des joueurs connectés, en mémoire (une par compte), à la place de Supabase. */
class InMemoryUserGames implements UserGames {

    private final Map<String, InMemoryGameStore> stores = new HashMap<>();

    @Override
    public GameStore forUser(String userId) {
        return stores.computeIfAbsent(userId, id -> new InMemoryGameStore());
    }

    void reset() {
        stores.clear();
    }
}
