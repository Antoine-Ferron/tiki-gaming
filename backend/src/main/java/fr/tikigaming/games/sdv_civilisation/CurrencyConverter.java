package fr.tikigaming.games.sdv_civilisation;

/** Contrat sans I/O : prix d'achat de ressources à un voisin, en pièces. */
public interface CurrencyConverter {

    int toCoins(Resource resource, int quantity);
}
