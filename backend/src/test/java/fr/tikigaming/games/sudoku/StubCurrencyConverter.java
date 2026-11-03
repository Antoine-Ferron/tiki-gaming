package fr.tikigaming.games.sudoku;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Stub : taux de change figé, réponses prévisibles. Refuse toute autre paire de devises que celle attendue, ce
 * qui vérifie au passage que le code testé demande la bonne conversion.
 */
final class StubCurrencyConverter implements CurrencyConverter {

    private final String expectedFrom;
    private final String expectedTo;
    private final BigDecimal rate;

    StubCurrencyConverter(String expectedFrom, String expectedTo, String rate) {
        this.expectedFrom = expectedFrom;
        this.expectedTo = expectedTo;
        this.rate = new BigDecimal(rate);
    }

    @Override
    public BigDecimal convert(BigDecimal amount, String from, String to) {
        if (!expectedFrom.equals(from) || !expectedTo.equals(to)) {
            throw new IllegalStateException("Conversion inattendue : " + from + " -> " + to);
        }
        return amount.multiply(rate).setScale(2, RoundingMode.HALF_EVEN);
    }
}
