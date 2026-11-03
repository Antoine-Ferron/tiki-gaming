package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RewardServiceTest {

    private static final Instant START = Instant.parse("2026-11-03T10:00:00Z");

    private FixedClock clock;
    private InMemoryLedger ledger;
    private RecordingAuditNotifier audit;
    private RewardService service;

    @BeforeEach
    void setUp() {
        clock = new FixedClock(START);
        ledger = new InMemoryLedger();
        audit = new RecordingAuditNotifier();
        // taux figé : 1 PTS = 0,01 TIKI
        service = new RewardService(clock, new StubCurrencyConverter("PTS", "TIKI", "0.01"), ledger, audit);
    }

    @Test
    void convertsScoreAtTheFrozenRate() {
        assertThat(service.reward("p1", 1166)).isEqualByComparingTo("11.66");
    }

    @Test
    void recordsTheRewardInTheLedgerAtClockTime() {
        service.reward("p1", 1166);

        assertThat(ledger.entriesOf("p1")).containsExactly(new LedgerEntry("p1", START, 1166, new BigDecimal("11.66")));
    }

    @Test
    void notifiesAuditWithDetails() {
        service.reward("p1", 1166);

        assertThat(audit.events())
                .containsExactly(new AuditEvent(
                        "REWARD_GRANTED", START, Map.of("player", "p1", "score", "1166", "coins", "11.66")));
    }

    @Test
    void balanceAccumulatesAcrossRewardsAndPlayersStayApart() {
        service.reward("p1", 1000);
        clock.advance(Duration.ofMinutes(5));
        service.reward("p1", 500);
        service.reward("p2", 300);

        assertThat(ledger.balanceOf("p1")).isEqualByComparingTo("15.00");
        assertThat(ledger.balanceOf("p2")).isEqualByComparingTo("3.00");
        assertThat(ledger.balanceOf("inconnu")).isEqualByComparingTo("0");
    }

    @Test
    void entriesKeepTheirOwnTimestampAndOrder() {
        service.reward("p1", 1000);
        clock.advance(Duration.ofMinutes(5));
        service.reward("p1", 500);

        assertThat(ledger.entriesOf("p1")).extracting(LedgerEntry::at).containsExactly(START, START.plusSeconds(300));
    }

    @Test
    void zeroScoreIsRecordedAsZeroCoins() {
        assertThat(service.reward("p1", 0)).isEqualByComparingTo("0");
        assertThat(ledger.size()).isEqualTo(1);
    }

    @Test
    void rejectsInvalidInputWithoutTouchingLedgerOrAudit() {
        assertThatThrownBy(() -> service.reward("p1", -1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.reward(" ", 100)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.reward(null, 100)).isInstanceOf(IllegalArgumentException.class);

        assertThat(ledger.size()).isZero();
        assertThat(audit.events()).isEmpty();
    }

    @Test
    void conversionFailureLeavesLedgerAndAuditUntouched() {
        // vrai convertisseur sans la devise TIKI : la conversion échoue
        RewardService failing = new RewardService(
                clock, new FixedRateCurrencyConverter(Map.of("PTS", new BigDecimal("0.01"))), ledger, audit);

        assertThatThrownBy(() -> failing.reward("p1", 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TIKI");
        assertThat(ledger.size()).isZero();
        assertThat(audit.events()).isEmpty();
    }
}
