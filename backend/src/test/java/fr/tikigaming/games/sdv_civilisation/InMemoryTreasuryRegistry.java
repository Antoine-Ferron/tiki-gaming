package fr.tikigaming.games.sdv_civilisation;

import java.util.HashMap;
import java.util.Map;

/** Fake : registre du trésor en mémoire, initialisé avec les soldes donnés. */
class InMemoryTreasuryRegistry implements TreasuryRegistry {

    private final Map<String, Integer> balances;

    InMemoryTreasuryRegistry(Map<String, Integer> initial) {
        this.balances = new HashMap<>(initial);
    }

    @Override
    public int balanceOf(String player) {
        return balances.getOrDefault(player, 0);
    }

    @Override
    public void setBalance(String player, int coins) {
        balances.put(player, coins);
    }
}
