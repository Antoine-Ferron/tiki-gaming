package fr.tikigaming.games.sudoku;

import java.time.Duration;
import java.time.Instant;

/** Horloge de test : figée, avancée à la main. */
final class FixedClock implements Clock {

    private Instant now;

    FixedClock(Instant start) {
        this.now = start;
    }

    void advance(Duration duration) {
        now = now.plus(duration);
    }

    @Override
    public Instant now() {
        return now;
    }
}
