package fr.tikigaming.games.sudoku;

import java.time.Duration;
import java.time.Instant;

/**
 * Chronomètre d'une partie. Le temps vient uniquement de {@link Clock} : avec une horloge figée, une transition
 * horaire se teste en avançant l'horloge à la main, sans {@code sleep}.
 *
 * <p>Transitions : non démarré, puis en cours (après {@link #start()}), puis arrêté (après {@link #stop()}).
 */
public final class GameTimer {

    private final Clock clock;
    private Instant startedAt;
    private Instant stoppedAt;

    public GameTimer(Clock clock) {
        this.clock = clock;
    }

    /** @throws IllegalStateException si déjà démarré */
    public void start() {
        if (startedAt != null) {
            throw new IllegalStateException("Chronomètre déjà démarré");
        }
        startedAt = clock.now();
    }

    /**
     * Fige la durée ; sans effet si déjà arrêté.
     *
     * @return la durée de la partie, en secondes entières
     * @throws IllegalStateException si non démarré
     */
    public int stop() {
        requireStarted();
        if (stoppedAt == null) {
            stoppedAt = clock.now();
        }
        return elapsedSeconds();
    }

    /**
     * @return secondes écoulées (tronquées), jamais négatives même si l'horloge recule
     * @throws IllegalStateException si non démarré
     */
    public int elapsedSeconds() {
        requireStarted();
        Instant end = stoppedAt != null ? stoppedAt : clock.now();
        long seconds = Duration.between(startedAt, end).toSeconds();
        return (int) Math.max(0, Math.min(seconds, Integer.MAX_VALUE));
    }

    private void requireStarted() {
        if (startedAt == null) {
            throw new IllegalStateException("Chronomètre non démarré");
        }
    }
}
