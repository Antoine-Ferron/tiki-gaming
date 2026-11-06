package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.prismine.TestDoubles.MutableClock;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** TU — la limite de démarrages suit le réglage reçu, et une adresse ne pénalise pas les autres. */
class StartLimiterTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-06T10:00:00Z"));

    @Test
    void theConfiguredLimitIsAppliedPerAddress() {
        StartLimiter limiter = new StartLimiter(clock, 2);
        limiter.acquire("10.0.0.1");
        limiter.acquire("10.0.0.1");

        assertThatThrownBy(() -> limiter.acquire("10.0.0.1"))
                .isInstanceOf(ApiException.class)
                .hasMessage(StartLimiter.TOO_MANY);
        assertThatCode(() -> limiter.acquire("10.0.0.2")).doesNotThrowAnyException();
    }
}
