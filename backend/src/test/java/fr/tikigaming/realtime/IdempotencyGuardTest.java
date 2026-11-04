package fr.tikigaming.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;

class IdempotencyGuardTest {

    private final MutableClock clock = new MutableClock();
    private final IdempotencyGuard guard = new IdempotencyGuard(clock);

    @Test
    void anActionIsFirstOnlyOnceInItsScope() {
        assertThat(guard.isFirst("room-1", "action-1")).isTrue();
        assertThat(guard.isFirst("room-1", "action-1")).isFalse();
        assertThat(guard.isFirst("room-1", "action-1")).isFalse();
    }

    @Test
    void theSameActionIdIsAllowedAgainInADifferentScope() {
        assertThat(guard.isFirst("room-1", "action-1")).isTrue();
        assertThat(guard.isFirst("room-2", "action-1")).isTrue();
    }

    @Test
    void anActionIsForgottenAfterTheRetentionWindow() {
        assertThat(guard.isFirst("room-1", "action-1")).isTrue();

        clock.advance(IdempotencyGuard.RETENTION.minusSeconds(1));
        assertThat(guard.isFirst("room-1", "action-1")).isFalse();

        clock.advance(Duration.ofSeconds(2));
        assertThat(guard.isFirst("room-1", "action-1")).isTrue();
    }

    @Test
    void thePeriodicCleanupDoesNotRunOnEveryCall() {
        guard.isFirst("room-1", "action-1");
        assertThat(guard.purgeRuns()).isZero();

        clock.advance(Duration.ofSeconds(1));
        guard.isFirst("room-1", "action-2");
        assertThat(guard.purgeRuns())
                .as("un appel rapproché ne redéclenche pas le nettoyage")
                .isZero();

        clock.advance(IdempotencyGuard.PURGE_INTERVAL);
        guard.isFirst("room-1", "action-3");
        assertThat(guard.purgeRuns()).isOne();
    }

    @Test
    void onlyOneOfManyConcurrentIdenticalActionsIsFirst() throws Exception {
        int contenders = 16;
        List<Boolean> results = new CopyOnWriteArrayList<>();
        try (var executor = Executors.newFixedThreadPool(contenders)) {
            CountDownLatch ready = new CountDownLatch(contenders);
            AtomicBoolean start = new AtomicBoolean();
            for (int i = 0; i < contenders; i++) {
                executor.submit(() -> {
                    ready.countDown();
                    while (!start.get()) Thread.onSpinWait();
                    results.add(guard.isFirst("room-1", "action-1"));
                });
            }
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.set(true);
            executor.shutdown();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }

        assertThat(results.stream().filter(Boolean::booleanValue)).hasSize(1);
        assertThat(results).hasSize(contenders);
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-03T12:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
