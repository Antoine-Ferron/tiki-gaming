package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.bang.model.TableSeat;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class PrivateTableServiceTest {

    private final PrivateTableService tables = new PrivateTableService();

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
                        ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(tables.join(original.code(), "creator")).isEqualTo(original);
        assertThat(tables.create("another-creator").code()).isNotEqualTo(original.code());
    }

    @Test
    void threeDistinctAccountsTakeTheRemainingSeats() {
        String code = tables.create("creator").code();

        for (int seat = 2; seat <= 4; seat++) {
            assertThat(tables.join(code, "player-" + seat)).isEqualTo(new TableSeat(code, seat, seat));
        }
    }

    @Test
    void refusesAnUnknownTableCode() {
        assertThatThrownBy(() -> tables.join("UNKNOWN", "player"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void refusesAFifthAccountAtAFullTable() {
        String code = tables.create("creator").code();
        for (int seat = 2; seat <= 4; seat++) {
            tables.join(code, "player-" + seat);
        }

        assertThatThrownBy(() -> tables.join(code, "fifth-account"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
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
                        } catch (ResponseStatusException error) {
                            assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
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
}
