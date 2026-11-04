package fr.tikigaming.resilience;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Disjoncteur : fermé → ouvert après N pannes → semi-ouvert après le délai → fermé ou rouvert. Horloge simulée. */
class CircuitBreakerTest {

    private static final int THRESHOLD = 3;
    private static final Duration OPEN = Duration.ofSeconds(30);

    /** Horloge qu'un test avance à la main : aucun test n'attend réellement. */
    private static final class ManualClock extends Clock {
        private Instant now = Instant.parse("2026-11-06T09:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }

    /** Panne de la dépendance (timeout, 5xx) : comptée par le disjoncteur. */
    private static final class Outage extends RuntimeException {}

    /** Refus métier (score trop haut…) : la dépendance répond, ce n'est pas une panne. */
    private static final class Refusal extends RuntimeException {}

    private final ManualClock clock = new ManualClock();
    private final CircuitBreaker breaker = new CircuitBreaker(THRESHOLD, OPEN, clock, Outage.class::isInstance);
    private final AtomicInteger calls = new AtomicInteger();

    private String ok() {
        calls.incrementAndGet();
        return "ok";
    }

    private String fail() {
        calls.incrementAndGet();
        throw new Outage();
    }

    private void failTimes(int n) {
        for (int i = 0; i < n; i++) {
            assertThatThrownBy(() -> breaker.call(this::fail)).isInstanceOf(Outage.class);
        }
    }

    private void open() {
        failTimes(THRESHOLD);
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);
        calls.set(0);
    }

    @Nested
    class Closed {

        @Test
        void letsTheCallThroughAndReturnsItsResult() {
            assertThat(breaker.call(CircuitBreakerTest.this::ok)).isEqualTo("ok");
            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        }

        @Test
        void staysClosedOneFailureBelowTheThreshold() {
            failTimes(THRESHOLD - 1);

            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        }

        @Test
        void opensAtTheThresholdOfConsecutiveFailures() {
            failTimes(THRESHOLD);

            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);
        }

        @Test
        void aSuccessResetsTheCountOfConsecutiveFailures() {
            failTimes(THRESHOLD - 1);
            breaker.call(CircuitBreakerTest.this::ok);
            failTimes(THRESHOLD - 1);

            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        }

        @Test
        void aBusinessRefusalIsNotAnOutageAndResetsTheCount() {
            failTimes(THRESHOLD - 1);
            for (int i = 0; i < THRESHOLD; i++) {
                assertThatThrownBy(() -> breaker.call(() -> {
                            throw new Refusal();
                        }))
                        .isInstanceOf(Refusal.class);
            }
            failTimes(THRESHOLD - 1);

            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        }
    }

    @Nested
    class Open {

        @Test
        void rejectsImmediatelyWithoutCallingTheDependency() {
            open();

            assertThatThrownBy(() -> breaker.call(CircuitBreakerTest.this::ok))
                    .isInstanceOf(CircuitOpenException.class);
            assertThat(calls).hasValue(0);
        }

        @Test
        void stillRejectsOneNanosecondBeforeTheEndOfTheDelay() {
            open();
            clock.advance(OPEN.minusNanos(1));

            assertThatThrownBy(() -> breaker.call(CircuitBreakerTest.this::ok))
                    .isInstanceOf(CircuitOpenException.class);
            assertThat(calls).hasValue(0);
        }

        @Test
        void tellsWhenTheNextTrialWillBeAllowed() {
            open();
            clock.advance(Duration.ofSeconds(10));

            assertThatThrownBy(() -> breaker.call(CircuitBreakerTest.this::ok))
                    .isInstanceOfSatisfying(
                            CircuitOpenException.class,
                            e -> assertThat(e.retryAfter()).isEqualTo(Duration.ofSeconds(20)));
        }
    }

    @Nested
    class HalfOpen {

        @Test
        void letsOneTrialCallThroughOnceTheDelayIsOver() {
            open();
            clock.advance(OPEN);

            assertThat(breaker.call(CircuitBreakerTest.this::ok)).isEqualTo("ok");
            assertThat(calls).hasValue(1);
        }

        @Test
        void aSuccessfulTrialClosesTheCircuit() {
            open();
            clock.advance(OPEN);
            breaker.call(CircuitBreakerTest.this::ok);

            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
            failTimes(THRESHOLD - 1);
            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        }

        @Test
        void aFailedTrialReopensForAFullDelay() {
            open();
            clock.advance(OPEN);
            failTimes(1);

            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);
            clock.advance(OPEN.minusNanos(1));
            assertThatThrownBy(() -> breaker.call(CircuitBreakerTest.this::ok))
                    .isInstanceOf(CircuitOpenException.class);
        }

        @Test
        void aRefusedTrialProvesTheDependencyAnswersAndClosesTheCircuit() {
            open();
            clock.advance(OPEN);
            assertThatThrownBy(() -> breaker.call(() -> {
                        throw new Refusal();
                    }))
                    .isInstanceOf(Refusal.class);

            assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        }

        @Test
        void rejectsOtherCallsWhileTheTrialIsRunning() {
            open();
            clock.advance(OPEN.plusSeconds(5));

            String result = breaker.call(() -> {
                assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.HALF_OPEN);
                assertThatThrownBy(() -> breaker.call(CircuitBreakerTest.this::ok))
                        .isInstanceOfSatisfying(
                                CircuitOpenException.class,
                                e -> assertThat(e.retryAfter()).isZero());
                return "essai";
            });

            assertThat(result).isEqualTo("essai");
            assertThat(calls).hasValue(0);
        }
    }

    @Test
    void refusesAThresholdBelowOne() {
        assertThatThrownBy(() -> new CircuitBreaker(0, OPEN, clock, e -> true))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void refusesADelayThatIsNotPositive() {
        assertThatThrownBy(() -> new CircuitBreaker(1, Duration.ZERO, clock, e -> true))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsTheSmallestThresholdAndOpensAtTheFirstFailure() {
        CircuitBreaker strict = new CircuitBreaker(1, OPEN, clock, Outage.class::isInstance);

        assertThatThrownBy(() -> strict.call(this::fail)).isInstanceOf(Outage.class);

        assertThat(strict.state()).isEqualTo(CircuitBreaker.State.OPEN);
    }

    @Test
    void refusesANegativeDelay() {
        assertThatThrownBy(() -> new CircuitBreaker(1, Duration.ofNanos(-1), clock, e -> true))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsTheSmallestPositiveDelay() {
        CircuitBreaker quick = new CircuitBreaker(1, Duration.ofNanos(1), clock, Outage.class::isInstance);
        assertThatThrownBy(() -> quick.call(this::fail)).isInstanceOf(Outage.class);
        clock.advance(Duration.ofNanos(1));

        assertThat(quick.call(this::ok)).isEqualTo("ok");
    }
}
