package fr.tikigaming.resilience;

import java.time.Duration;

/** Appel refusé sans être tenté : le disjoncteur est ouvert (ou un appel d'essai est déjà en cours). */
public class CircuitOpenException extends RuntimeException {

    private final Duration retryAfter;

    public CircuitOpenException(Duration retryAfter) {
        super("Circuit ouvert : dépendance indisponible, appel non tenté");
        this.retryAfter = retryAfter;
    }

    /** Délai avant que le disjoncteur autorise un nouvel essai (zéro si un essai est déjà en cours). */
    public Duration retryAfter() {
        return retryAfter;
    }
}
