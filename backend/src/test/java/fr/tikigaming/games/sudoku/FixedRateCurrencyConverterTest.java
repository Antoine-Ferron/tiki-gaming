package fr.tikigaming.games.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FixedRateCurrencyConverterTest {

    // Référence : EUR. 1 USD = 0,50 EUR ; 1 PTS = 0,01 EUR.
    private final CurrencyConverter converter = new FixedRateCurrencyConverter(Map.of(
            "EUR", new BigDecimal("1"),
            "USD", new BigDecimal("0.50"),
            "PTS", new BigDecimal("0.01")));

    @Test
    void convertsThroughTheReferenceCurrency() {
        assertThat(converter.convert(new BigDecimal("10"), "USD", "EUR")).isEqualByComparingTo("5.00");
        assertThat(converter.convert(new BigDecimal("10"), "EUR", "USD")).isEqualByComparingTo("20.00");
        assertThat(converter.convert(new BigDecimal("1000"), "PTS", "USD")).isEqualByComparingTo("20.00");
    }

    @Test
    void sameCurrencyKeepsTheAmount() {
        assertThat(converter.convert(new BigDecimal("12.34"), "USD", "USD")).isEqualByComparingTo("12.34");
    }

    @Test
    void zeroConvertsToZero() {
        assertThat(converter.convert(BigDecimal.ZERO, "EUR", "USD")).isEqualByComparingTo("0");
    }

    @Test
    void roundsHalfEvenToTwoDecimals() {
        // 0,05 USD = 0,025 EUR -> 0,02 (le chiffre pair le plus proche) ; 0,07 USD = 0,035 EUR -> 0,04
        assertThat(converter.convert(new BigDecimal("0.05"), "USD", "EUR")).isEqualByComparingTo("0.02");
        assertThat(converter.convert(new BigDecimal("0.07"), "USD", "EUR")).isEqualByComparingTo("0.04");
    }

    @Test
    void isDeterministic() {
        BigDecimal first = converter.convert(new BigDecimal("7.77"), "EUR", "PTS");

        assertThat(converter.convert(new BigDecimal("7.77"), "EUR", "PTS")).isEqualTo(first);
    }

    @Test
    void rejectsNegativeAmount() {
        assertThatThrownBy(() -> converter.convert(new BigDecimal("-1"), "EUR", "USD"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsUnknownCurrency() {
        assertThatThrownBy(() -> converter.convert(BigDecimal.ONE, "EUR", "XXX"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("XXX");
        assertThatThrownBy(() -> converter.convert(BigDecimal.ONE, "YYY", "EUR"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("YYY");
    }

    @Test
    void rejectsNonPositiveRates() {
        assertThatThrownBy(() -> new FixedRateCurrencyConverter(Map.of("EUR", BigDecimal.ZERO)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
