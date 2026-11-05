package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Limite le nombre de parties vérifiées par minute et par client (OWASP API4 : consommation de ressources sans
 * limite). Horloge injectée : on avance le temps sans attendre une vraie minute.
 */
class ResultRateLimiterTest {

    /** Horloge réglable à la main pour les tests. */
    static final class ManualClock extends Clock {
        private Instant now = Instant.parse("2026-11-05T10:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    private final ManualClock clock = new ManualClock();

    /** Accepte `n` demandes du même client et renvoie la réponse à la suivante. */
    private static boolean nextAfter(ResultRateLimiter limiter, String client, int n) {
        for (int i = 0; i < n; i++) limiter.tryAcquire(client);
        return limiter.tryAcquire(client);
    }

    @ParameterizedTest(name = "limite de 3 : la demande n°{0} → acceptée : {1}")
    @CsvSource({"1, true", "3, true", "4, false"})
    void acceptsUpToTheLimitThenRefuses(int rank, boolean accepted) {
        // Arrange
        ResultRateLimiter limiter = new ResultRateLimiter(3, clock);

        // Act
        boolean result = nextAfter(limiter, "203.0.113.7", rank - 1);

        // Assert
        assertThat(result).isEqualTo(accepted);
    }

    @ParameterizedTest(name = "{0} s après la première demande → acceptée : {1}")
    @CsvSource({"59, false", "60, true"})
    void aNewMinuteGivesTheClientNewRequests(int seconds, boolean accepted) {
        // Arrange : le client a épuisé sa minute
        ResultRateLimiter limiter = new ResultRateLimiter(3, clock);
        nextAfter(limiter, "203.0.113.7", 3);

        // Act
        clock.advance(Duration.ofSeconds(seconds));
        boolean result = limiter.tryAcquire("203.0.113.7");

        // Assert
        assertThat(result).isEqualTo(accepted);
    }

    @Test
    void eachClientHasItsOwnLimit() {
        // Arrange : un client a épuisé sa minute
        ResultRateLimiter limiter = new ResultRateLimiter(3, clock);
        nextAfter(limiter, "203.0.113.7", 3);

        // Act
        boolean other = limiter.tryAcquire("198.51.100.2");

        // Assert
        assertThat(other).isTrue();
    }
}
