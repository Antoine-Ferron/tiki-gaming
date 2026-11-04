package fr.tikigaming.games.sudoku;

import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Horloge de production : lit une {@link java.time.Clock}. Par défaut l'heure système UTC ; les tests lui donnent
 * une horloge figée ou décalée, sans jamais lire l'heure réelle.
 */
@Component("sudokuClock")
public final class SystemClock implements Clock {

    private final java.time.Clock source;

    @Autowired
    public SystemClock() {
        this(java.time.Clock.systemUTC());
    }

    public SystemClock(java.time.Clock source) {
        this.source = source;
    }

    @Override
    public Instant now() {
        return source.instant();
    }
}
