package fr.tikigaming.games.sdv_civilisation;

/** Implémentation de production : prix standard du commerce, 2 pièces par ressource. */
public final class StandardTrade implements CurrencyConverter {

    public static final int PRICE = 2;

    @Override
    public int toCoins(Resource resource, int quantity) {
        return quantity * PRICE;
    }
}
