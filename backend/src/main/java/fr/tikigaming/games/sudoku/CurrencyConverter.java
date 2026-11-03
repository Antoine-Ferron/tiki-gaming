package fr.tikigaming.games.sudoku;

import java.math.BigDecimal;

/** Conversion d'un montant d'une devise à une autre. Pure : aucune lecture de taux sur le réseau ni le disque. */
public interface CurrencyConverter {

    /**
     * @param amount montant à convertir, positif ou nul
     * @param from code de la devise source (ex. {@code "EUR"})
     * @param to code de la devise cible
     * @return le montant converti
     * @throws IllegalArgumentException si le montant est négatif ou si une devise est inconnue
     */
    BigDecimal convert(BigDecimal amount, String from, String to);
}
