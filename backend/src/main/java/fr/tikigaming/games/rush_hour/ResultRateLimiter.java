package fr.tikigaming.games.rush_hour;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Limite le nombre de parties vérifiées par minute et par client (OWASP API4 : consommation de ressources sans
 * limite). Fenêtre fixe d'une minute, ouverte par la première demande du client.
 */
@Component
public class ResultRateLimiter {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    /** Au-delà, les fenêtres terminées sont oubliées pour que la mémoire reste bornée. */
    private static final int CLEANUP_THRESHOLD = 10_000;

    private record Window(Instant start, int count) {}

    private final int maxPerMinute;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Autowired
    public ResultRateLimiter(@Value("${tiki.rush-hour.max-results-per-minute:60}") int maxPerMinute) {
        this(maxPerMinute, Clock.systemUTC());
    }

    public ResultRateLimiter(int maxPerMinute, Clock clock) {
        this.maxPerMinute = maxPerMinute;
        this.clock = clock;
    }

    /** Vrai si le client peut encore faire vérifier une partie cette minute-ci. */
    public boolean tryAcquire(String client) {
        Instant now = clock.instant();
        if (windows.size() > CLEANUP_THRESHOLD) windows.values().removeIf(w -> expired(w, now));
        Window window = windows.compute(client, (key, current) -> {
            if (current == null || expired(current, now)) return new Window(now, 1);
            return new Window(current.start(), current.count() + 1);
        });
        return window.count() <= maxPerMinute;
    }

    private static boolean expired(Window window, Instant now) {
        return !now.isBefore(window.start().plus(WINDOW));
    }
}
