package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
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
    void systemClockReadsFromTheInjectedJavaClock() {
        Instant instant = Instant.parse("2026-11-03T10:00:00Z");
        Clock clock = new SystemClock(java.time.Clock.fixed(instant, ZoneOffset.UTC));

        assertThat(clock.now()).isEqualTo(instant);
        assertThat(clock.now()).isEqualTo(instant);
    }

    @Test
    void systemClockFollowsTheUnderlyingClockWhenItMoves() {
        java.time.Clock base = java.time.Clock.fixed(START, ZoneOffset.UTC);
        Clock later = new SystemClock(java.time.Clock.offset(base, Duration.ofMinutes(5)));

        assertThat(later.now()).isEqualTo(START.plus(Duration.ofMinutes(5)));
    }

    @Test
    void defaultSystemClockIsUtcAndPlausible() {
        // Seule lecture de l'heure réelle : une borne très large (jamais avant 2020), donc sans risque de flaky.
        assertThat(new SystemClock().now()).isAfter(Instant.parse("2020-01-01T00:00:00Z"));
    }
}
