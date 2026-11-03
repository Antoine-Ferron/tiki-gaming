package fr.tikigaming.games.sdv_civilisation;

/** Stub : convertit toujours au même taux, quel que soit le prix réel du commerce. */
record FixedRateConverter(int coinsPerResource) implements CurrencyConverter {

    @Override
    public int toCoins(Resource resource, int quantity) {
        return quantity * coinsPerResource;
    }
}
