package fr.tikigaming.games.sdv_civilisation;

/** Commerce avec les voisins, voir docs/games/sdv-civilisation/regles.md#commerce */
public final class Trade {

    private final CurrencyConverter converter;
    private final Treasury treasury;

    public Trade(CurrencyConverter converter, Treasury treasury) {
        this.converter = converter;
        this.treasury = treasury;
    }

    /** Renvoie le prix payé ; un achat impayable est refusé sans changer aucun trésor. */
    public int buy(Purchase purchase) {
        if (purchase.quantity() < 1) {
            throw new IllegalArgumentException("On achète au moins une ressource");
        }
        if (purchase.buyer().equals(purchase.seller())) {
            throw new IllegalArgumentException("On achète à un voisin, pas à soi-même");
        }
        int price = converter.toCoins(purchase.resource(), purchase.quantity());
        treasury.transfer(purchase.buyer(), purchase.seller(), price);
        return price;
    }
}
