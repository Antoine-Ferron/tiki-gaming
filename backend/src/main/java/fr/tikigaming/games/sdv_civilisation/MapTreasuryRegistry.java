package fr.tikigaming.games.sdv_civilisation;

import java.util.Map;

/** Registre du trésor d'un tour : les pièces de chaque joueur, le temps d'appliquer les paiements. */
final class MapTreasuryRegistry implements TreasuryRegistry {

    private final Map<String, Integer> balances;

    MapTreasuryRegistry(Map<String, Integer> balances) {
        this.balances = balances;
    }

    @Override
    public int balanceOf(String player) {
        return balances.get(player);
    }

    @Override
    public void setBalance(String player, int coins) {
        balances.put(player, coins);
    }
}
