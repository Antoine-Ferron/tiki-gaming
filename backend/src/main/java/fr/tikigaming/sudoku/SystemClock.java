package fr.tikigaming.sudoku;

import java.time.Instant;

/** Horloge de production : délègue à l'heure système. Seul adaptateur non déterministe du package. */
public final class SystemClock implements Clock {

    @Override
    public Instant now() {
        return Instant.now();
    }
}
