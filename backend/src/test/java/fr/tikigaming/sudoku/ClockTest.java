package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ClockTest {

    private static final Instant START = Instant.parse("2026-11-03T10:00:00Z");

    @Test
    void fixedClockStaysStillUntilAdvanced() {
        FixedClock clock = new FixedClock(START);

        assertThat(clock.now()).isEqualTo(START);
        assertThat(clock.now()).isEqualTo(START);
        clock.advance(Duration.ofSeconds(90));
        assertThat(clock.now()).isEqualTo(START.plusSeconds(90));
    }

    @Test
    void elapsedTimeIsComputedFromTheClockOnly() {
        FixedClock clock = new FixedClock(START);
        Instant started = clock.now();

        clock.advance(Duration.ofSeconds(540));

        assertThat(Duration.between(started, clock.now()).toSeconds()).isEqualTo(540);
    }

    @Test
    void systemClockNeverGoesBackwardsBetweenTwoReads() {
        Clock clock = new SystemClock();

        Instant first = clock.now();
        Instant second = clock.now();

        assertThat(second).isAfterOrEqualTo(first);
    }
}
