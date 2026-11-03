package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AdaptersTest {

    @Test
    void standardTradePriceIsTwoCoinsPerResource() {
        assertThat(StandardTrade.PRICE).isEqualTo(2);
    }

    @ParameterizedTest
    @CsvSource({"1, 2", "3, 6"})
    void standardTradeConvertsResourcesToCoins(int quantity, int expected) {
        assertThat(new StandardTrade().toCoins(Resource.PAPYRUS, quantity)).isEqualTo(expected);
    }

    @Test
    void systemClockGivesTheSystemTime() {
        long before = System.currentTimeMillis();

        long now = new SystemClock().now();

        assertThat(now).isBetween(before, System.currentTimeMillis());
    }

    @Test
    void logAuditNotifierOnlyWritesToTheLog() {
        assertThatCode(() -> new LogAuditNotifier().treasuryThresholdCrossed(new TreasuryAlert("alice", 30, 30)))
                .doesNotThrowAnyException();
    }
}
