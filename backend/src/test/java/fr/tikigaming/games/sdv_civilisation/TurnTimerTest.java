package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TurnTimerTest {

    @Test
    void movesFromRunningToWarningToExpiredWithoutRealWaiting() {
        // Fake : l'horloge avance à la main, aucune attente réelle.
        FakeClock clock = new FakeClock(1_000);
        TurnTimer turn = TurnTimer.start(clock);

        assertThat(turn.deadline()).isEqualTo(61_000);
        assertThat(turn.phase()).isEqualTo(TurnPhase.RUNNING);
        clock.advance(50_000);
        assertThat(turn.phase()).isEqualTo(TurnPhase.WARNING);
        assertThat(turn.remainingMillis()).isEqualTo(10_000);
        clock.advance(10_000);
        assertThat(turn.phase()).isEqualTo(TurnPhase.EXPIRED);
    }
}
