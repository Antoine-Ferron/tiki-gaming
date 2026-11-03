package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import org.junit.jupiter.api.Test;

class AdaptersTest {

    @Test
    void productionAdapters() {
        long before = System.currentTimeMillis();

        assertThat(new StandardTrade().toCoins(Resource.PAPYRUS, 3)).isEqualTo(6);
        assertThat(new SystemClock().now()).isBetween(before, System.currentTimeMillis());
        assertThatCode(() -> new LogAuditNotifier().treasuryThresholdCrossed(new TreasuryAlert("alice", 30, 30)))
                .doesNotThrowAnyException();
    }
}
