package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TurnTimerTest {

    private static final long START = 1_700_000_000_000L;

    @Test
    void lastsSixtySecondsIncludingTenSecondsOfWarning() {
        assertThat(TurnTimer.DURATION_MILLIS).isEqualTo(60_000L);
        assertThat(TurnTimer.WARNING_MILLIS).isEqualTo(10_000L);
    }

    // Une ligne par frontière : aucune attente réelle, l'horloge avance à la main.
    @ParameterizedTest
    @CsvSource({"0, RUNNING", "49999, RUNNING", "50000, WARNING", "59999, WARNING", "60000, EXPIRED", "90000, EXPIRED"})
    void phaseDependsOnElapsedTime(long elapsed, TurnPhase expected) {
        FakeClock clock = new FakeClock(START);
        TurnTimer turn = TurnTimer.start(clock);

        clock.advance(elapsed);

        assertThat(turn.phase()).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"0, 60000", "45500, 14500", "60000, 0", "75000, 0"})
    void remainingTimeNeverGoesBelowZero(long elapsed, long remaining) {
        FakeClock clock = new FakeClock(START);
        TurnTimer turn = TurnTimer.start(clock);

        clock.advance(elapsed);

        assertThat(turn.remainingMillis()).isEqualTo(remaining);
    }

    @Test
    void countsFromTheStartOfTheTurnNotFromTheClockOrigin() {
        FakeClock clock = new FakeClock(0);
        clock.advance(55_000);
        TurnTimer turn = TurnTimer.start(clock);

        clock.advance(5_000);

        assertThat(turn.phase()).isEqualTo(TurnPhase.RUNNING);
    }

    @Test
    void movesThroughEachPhaseDuringTheSameTurn() {
        FakeClock clock = new FakeClock(START);
        TurnTimer turn = TurnTimer.start(clock);
        List<TurnPhase> phases = new ArrayList<>();

        phases.add(turn.phase());
        clock.advance(50_000);
        phases.add(turn.phase());
        clock.advance(10_000);
        phases.add(turn.phase());

        assertThat(phases).containsExactly(TurnPhase.RUNNING, TurnPhase.WARNING, TurnPhase.EXPIRED);
    }

    @Test
    void acceptsACustomDuration() {
        FakeClock clock = new FakeClock(START);
        TurnTimer turn = TurnTimer.start(clock, 20_000);

        clock.advance(20_000);

        assertThat(turn.phase()).isEqualTo(TurnPhase.EXPIRED);
    }
}
