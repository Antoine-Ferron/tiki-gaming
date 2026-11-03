package fr.tikigaming.games.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Aucun sleep : le temps est une valeur que le test avance à la main sur une horloge figée. */
class GameTimerTest {

    private static final Instant START = Instant.parse("2026-11-03T10:00:00Z");

    private FixedClock clock;
    private GameTimer timer;

    @BeforeEach
    void setUp() {
        clock = new FixedClock(START);
        timer = new GameTimer(clock);
    }

    @Test
    void elapsedIsZeroRightAfterStart() {
        timer.start();

        assertThat(timer.elapsedSeconds()).isZero();
    }

    @Test
    void elapsedFollowsTheClock() {
        timer.start();
        clock.advance(Duration.ofSeconds(90));

        assertThat(timer.elapsedSeconds()).isEqualTo(90);
    }

    @ParameterizedTest(name = "{0} ms -> {1} s")
    @CsvSource({"0, 0", "999, 0", "1000, 1", "1500, 1", "1999, 1", "2000, 2"})
    void elapsedTruncatesToWholeSeconds(long millis, int expectedSeconds) {
        timer.start();
        clock.advance(Duration.ofMillis(millis));

        assertThat(timer.elapsedSeconds()).isEqualTo(expectedSeconds);
    }

    @Test
    void stopFreezesTheElapsedTime() {
        timer.start();
        clock.advance(Duration.ofSeconds(120));

        assertThat(timer.stop()).isEqualTo(120);
        clock.advance(Duration.ofHours(1));

        assertThat(timer.elapsedSeconds()).isEqualTo(120);
    }

    @Test
    void stopIsIdempotent() {
        timer.start();
        clock.advance(Duration.ofSeconds(10));
        int first = timer.stop();
        clock.advance(Duration.ofSeconds(50));

        assertThat(timer.stop()).isEqualTo(first);
    }

    @Test
    void elapsedNeverGoesNegativeIfTheClockMovesBackwards() {
        timer.start();
        clock.advance(Duration.ofSeconds(-30));

        assertThat(timer.elapsedSeconds()).isZero();
    }

    @Test
    void rejectsInvalidTransitions() {
        assertThatThrownBy(() -> timer.elapsedSeconds()).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> timer.stop()).isInstanceOf(IllegalStateException.class);

        timer.start();
        assertThatThrownBy(() -> timer.start()).isInstanceOf(IllegalStateException.class);
    }

    /** Transition horaire du bonus de temps : seuil de 60 s gagnées sur 600 s (facile), franchi à 540 s. */
    @ParameterizedTest(name = "partie de {0} s -> bonus de temps {1}")
    @CsvSource({"500, 100", "539, 61", "540, 60", "541, 0", "600, 0", "700, 0"})
    void timeBonusSwitchesOnAndOffAtTheActivationThreshold(int playedSeconds, int expectedBonus) {
        timer.start();
        clock.advance(Duration.ofSeconds(playedSeconds));

        int seconds = timer.stop();

        assertThat(ScoreCalculator.compute(Difficulty.EASY, seconds, 0).timeBonus())
                .isEqualTo(expectedBonus);
    }
}
