package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import fr.tikigaming.games.bang.model.TableSeat;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;

class PrivateTableServiceTest {

    private final MutableClock clock = new MutableClock();
    private final PrivateTableService tables = new PrivateTableService(mock(InitialDeal.class), clock);

    @Test
    void createsATableWithAShareableCodeAndTheCreatorsSeat() {
        TableSeat created = tables.create("creator");

        assertThat(created).isNotNull();
        assertThat(created.code()).isNotBlank();
        assertThat(created.seat()).isEqualTo(1);
        assertThat(created.playerCount()).isEqualTo(1);
    }

    @Test
    void aCreatorCanCreateOnlyOnePrivateTable() {
        TableSeat original = tables.create("creator");

        assertThatThrownBy(() -> tables.create("creator"))
                .isInstanceOfSatisfying(
                        PrivateTableException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(tables.join(original.code(), "creator")).isEqualTo(original);
        assertThat(tables.create("another-creator").code()).isNotEqualTo(original.code());
    }

    @Test
    void theNumberOfStoredTablesIsBoundedAndExistingSeatsRemainAvailable() {
        TableSeat first = tables.create("creator-0");
        for (int account = 1; account < 1000; account++) {
            tables.create("creator-" + account);
        }

        assertThatThrownBy(() -> tables.create("one-too-many"))
                .isInstanceOfSatisfying(
                        PrivateTableException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        assertThat(tables.join(first.code(), "creator-0")).isEqualTo(first);
        assertThat(tables.join(first.code(), "joining-player")).isEqualTo(new TableSeat(first.code(), 2, 2));
    }

    @Test
    void threeDistinctAccountsTakeTheRemainingSeats() {
        String code = tables.create("creator").code();

        for (int seat = 2; seat <= 4; seat++) {
            assertThat(tables.join(code, "player-" + seat)).isEqualTo(new TableSeat(code, seat, seat));
        }
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"UNKNOWN", "  "})
    void refusesAnUnknownTableCode(String code) {
        assertThatThrownBy(() -> tables.join(code, "player"))
                .isInstanceOfSatisfying(
                        PrivateTableException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void joiningNormalizesTheCodeAndReturnsItsCanonicalValue() {
        String code = tables.create("creator").code();
        String entered = " \t" + code.toLowerCase(Locale.ROOT) + "  ";

        assertThat(tables.join(entered, "second")).isEqualTo(new TableSeat(code, 2, 2));
        assertThat(tables.join(entered, "second")).isEqualTo(new TableSeat(code, 2, 2));
    }

    @Test
    void refusesAFifthAccountAtAFullTable() {
        String code = tables.create("creator").code();
        for (int seat = 2; seat <= 4; seat++) {
            tables.join(code, "player-" + seat);
        }

        assertThatThrownBy(() -> tables.join(code, "fifth-account"))
                .isInstanceOfSatisfying(
                        PrivateTableException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void onlyOneOfManyConcurrentAccountsCanTakeTheLastSeat() throws Exception {
        int contenders = 8;
        try (var executor = Executors.newFixedThreadPool(contenders)) {
            for (int round = 0; round < 100; round++) {
                String creator = "creator-" + round;
                String code = tables.create(creator).code();
                tables.join(code, "second");
                tables.join(code, "third");
                CountDownLatch ready = new CountDownLatch(contenders);
                AtomicBoolean start = new AtomicBoolean();
                List<Future<TableSeat>> attempts = new ArrayList<>();
                for (int account = 0; account < contenders; account++) {
                    String accountId = "challenger-" + account;
                    attempts.add(executor.submit(() -> {
                        ready.countDown();
                        // Un réveil bloquant peut sérialiser ces appels très courts.
                        while (!start.get()) Thread.onSpinWait();
                        try {
                            return tables.join(code, accountId);
                        } catch (PrivateTableException error) {
                            assertThat(error.status()).isEqualTo(HttpStatus.CONFLICT);
                            return null;
                        }
                    }));
                }
                try {
                    assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
                } finally {
                    start.set(true);
                }

                List<TableSeat> accepted = new ArrayList<>();
                for (Future<TableSeat> attempt : attempts) {
                    TableSeat seat = attempt.get(5, TimeUnit.SECONDS);
                    if (seat != null) accepted.add(seat);
                }
                assertThat(accepted).as("round %s", round).containsExactly(new TableSeat(code, 4, 4));
                assertThat(tables.join(code, creator)).isEqualTo(new TableSeat(code, 1, 4));
            }
        }
    }

    @Test
    void theSameAccountKeepsItsSeatWithoutConsumingAnotherPlace() {
        String code = tables.create("creator").code();
        TableSeat second = tables.join(code, "second");

        assertThat(tables.join(code, "second")).isEqualTo(second);
        assertThat(tables.join(code, "creator")).isEqualTo(new TableSeat(code, 1, 2));
        assertThat(tables.join(code, "third")).isEqualTo(new TableSeat(code, 3, 3));
        assertThat(tables.join(code, "fourth")).isEqualTo(new TableSeat(code, 4, 4));
        assertThat(tables.join(code, "second")).isEqualTo(new TableSeat(code, 2, 4));
    }

    @Test
    void anInactiveTableIsRemovedAndItsCreatorCanOpenANewOne() {
        String code = tables.create("creator").code();

        clock.advance(PrivateTableService.INACTIVITY_TIMEOUT);

        assertThatThrownBy(() -> tables.join(code, "creator"))
                .isInstanceOfSatisfying(
                        PrivateTableException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThat(tables.create("creator").code()).isNotEqualTo(code);
    }

    @Test
    void joiningKeepsATableAlive() {
        String code = tables.create("creator").code();

        clock.advance(PrivateTableService.INACTIVITY_TIMEOUT.minusMinutes(1));
        tables.join(code, "second");
        clock.advance(PrivateTableService.INACTIVITY_TIMEOUT.minusMinutes(1));

        assertThat(tables.join(code, "creator")).isEqualTo(new TableSeat(code, 1, 2));
    }

    @Test
    void aRefusedJoinAtAFullTableDoesNotKeepItAlive() {
        String code = tables.create("creator").code();
        tables.join(code, "second");
        tables.join(code, "third");
        tables.join(code, "fourth");

        clock.advance(PrivateTableService.INACTIVITY_TIMEOUT.minusMinutes(1));
        assertThatThrownBy(() -> tables.join(code, "fifth")).isInstanceOf(PrivateTableException.class);
        clock.advance(Duration.ofMinutes(1));

        assertThatThrownBy(() -> tables.join(code, "creator"))
                .isInstanceOfSatisfying(
                        PrivateTableException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void inactiveTablesFreeTheGlobalCapacity() {
        for (int account = 0; account < PrivateTableService.MAX_TABLES; account++) {
            tables.create("creator-" + account);
        }

        clock.advance(PrivateTableService.INACTIVITY_TIMEOUT);

        assertThat(tables.create("newcomer").seat()).isEqualTo(1);
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
