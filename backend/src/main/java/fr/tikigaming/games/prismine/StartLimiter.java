package fr.tikigaming.games.prismine;

import fr.tikigaming.config.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * Limite le nombre d'expéditions commencées par une même adresse sur une fenêtre glissante. Un invité qui ne garde
 * pas son cookie de session obtient une nouvelle session à chaque requête : sans cette limite, un script remplirait
 * la table prismine_runs (et la mémoire des sessions) jusqu'à la purge de 24 h.
 */
class StartLimiter {

    static final int MAX_STARTS = 30;
    static final Duration WINDOW = Duration.ofMinutes(10);
    static final String TOO_MANY =
            "Trop d'expéditions commencées depuis ta connexion : attends quelques minutes avant d'en relancer une.";

    /** Au-delà, les adresses sans démarrage récent sont oubliées : la table ne grossit pas indéfiniment. */
    private static final int MAX_TRACKED = 10_000;

    private final Clock clock;
    private final int maxStarts;
    private final Map<String, Deque<Instant>> starts = new HashMap<>();

    StartLimiter(Clock clock) {
        this(clock, MAX_STARTS);
    }

    StartLimiter(Clock clock, int maxStarts) {
        this.clock = clock;
        this.maxStarts = maxStarts;
    }

    /** Enregistre un démarrage pour {@code client}, ou lève une {@link ApiException} 429 si la limite est atteinte. */
    synchronized void acquire(String client) {
        Instant now = clock.instant();
        Instant cutoff = now.minus(WINDOW);
        if (starts.size() > MAX_TRACKED) {
            starts.values()
                    .removeIf(times -> times.isEmpty() || !times.peekLast().isAfter(cutoff));
        }
        Deque<Instant> times = starts.computeIfAbsent(client, k -> new ArrayDeque<>());
        while (!times.isEmpty() && !times.peekFirst().isAfter(cutoff)) times.pollFirst();
        if (times.size() >= maxStarts) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, TOO_MANY);
        times.addLast(now);
    }
}
