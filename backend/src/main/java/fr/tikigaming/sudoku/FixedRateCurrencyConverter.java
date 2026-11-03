package fr.tikigaming.sudoku;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Convertisseur à taux fixes, tout en mémoire. Chaque taux dit combien vaut une unité de la devise
 * en unités de la devise de référence ; la conversion passe par cette référence.
 */
public final class FixedRateCurrencyConverter implements CurrencyConverter {

    private static final int SCALE = 2;

    private final Map<String, BigDecimal> ratesToReference;

    /** @param ratesToReference valeur d'une unité de chaque devise dans la devise de référence (taux strictement positifs) */
    public FixedRateCurrencyConverter(Map<String, BigDecimal> ratesToReference) {
        for (Map.Entry<String, BigDecimal> rate : ratesToReference.entrySet()) {
            if (rate.getValue().signum() <= 0) {
                throw new IllegalArgumentException("Taux invalide pour " + rate.getKey());
            }
        }
        this.ratesToReference = new HashMap<>(ratesToReference);
    }

    @Override
    public BigDecimal convert(BigDecimal amount, String from, String to) {
        if (amount.signum() < 0) {
            throw new IllegalArgumentException("Le montant doit être positif");
        }
        BigDecimal fromRate = rate(from);
        BigDecimal toRate = rate(to);
        return amount.multiply(fromRate).divide(toRate, SCALE, RoundingMode.HALF_EVEN);
    }

    private BigDecimal rate(String currency) {
        BigDecimal rate = ratesToReference.get(currency);
        if (rate == null) {
            throw new IllegalArgumentException("Devise inconnue : " + currency);
        }
        return rate;
    }
}
