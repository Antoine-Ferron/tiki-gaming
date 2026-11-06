package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.config.TikiProperties;
import fr.tikigaming.games.prismine.TestDoubles.MutableClock;
import fr.tikigaming.resilience.CircuitBreaker;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/** TU — disjoncteur devant Supabase : horloge pilotée, sans réseau ni attente. */
class PrismineSupabaseBreakerTest {

    private static final int THRESHOLD = 3;
    private static final Duration OPEN_DURATION = Duration.ofSeconds(30);

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-06T10:00:00Z"));
    private final CircuitBreaker breaker =
            new CircuitBreaker(THRESHOLD, OPEN_DURATION, clock, PrismineSupabase::isOutage);
    private final PrismineSupabase supabase = new PrismineSupabase(
            RestClient.builder(),
            new TikiProperties(
                    "http://localhost:5173",
                    new TikiProperties.Supabase(
                            "https://ref.supabase.invalid", "anon", "service", "jwt-secret", Duration.ofHours(1))),
            breaker);
    private final AtomicInteger calls = new AtomicInteger();

    private final Supplier<String> outage = () -> {
        calls.incrementAndGet();
        throw new ResourceAccessException("Supabase injoignable");
    };
    private final Supplier<String> healthy = () -> {
        calls.incrementAndGet();
        return "ok";
    };

    private void failUntilOpen() {
        for (int i = 0; i < THRESHOLD; i++) {
            assertThatThrownBy(() -> supabase.call(outage))
                    .isInstanceOf(ApiException.class)
                    .hasMessage(PrismineSupabase.UNAVAILABLE)
                    .extracting("status")
                    .isEqualTo(HttpStatus.BAD_GATEWAY);
        }
    }

    @Test
    void consecutiveOutagesOpenTheCircuitWhichAnswers503WithoutCallingSupabase() {
        failUntilOpen();
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);
        int callsWhenOpened = calls.get();

        assertThatThrownBy(() -> supabase.call(healthy))
                .isInstanceOf(ApiException.class)
                .hasMessage(PrismineSupabase.UNAVAILABLE)
                .extracting("status")
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(calls).hasValue(callsWhenOpened);
    }

    @Test
    void theCircuitClosesAfterTheDelayOnceSupabaseIsBack() {
        failUntilOpen();

        clock.advance(OPEN_DURATION);

        assertThat(supabase.call(healthy)).isEqualTo("ok");
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void aBusinessRefusalProvesSupabaseAnswersAndNeverOpensTheCircuit() {
        for (int i = 0; i < THRESHOLD + 1; i++) {
            assertThatThrownBy(() -> supabase.call(() -> {
                        throw new ApiException(HttpStatus.CONFLICT, RunRepository.CONFLICT);
                    }))
                    .isInstanceOf(ApiException.class)
                    .extracting("status")
                    .isEqualTo(HttpStatus.CONFLICT);
        }

        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
    }
}
