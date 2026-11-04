package fr.tikigaming.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
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

class GameRoomServiceTest {

    private static final String SLUG = "bataille-navale";

    private final MutableClock clock = new MutableClock();
    private final GameRoomService rooms = new GameRoomService(clock);

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    void refusesToCreateARoomWithFewerThanOnePlayer(int maxPlayers) {
        assertThatThrownBy(() -> rooms.createRoom(SLUG, "creator", maxPlayers))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void createsARoomWithAShareableCodeAndTheCreatorsSeat() {
        RoomView created = rooms.createRoom(SLUG, "creator", 4);

        assertThat(created.code()).isNotBlank();
        assertThat(created.gameSlug()).isEqualTo(SLUG);
        assertThat(created.seat()).isEqualTo(1);
        assertThat(created.playerCount()).isEqualTo(1);
        assertThat(created.maxPlayers()).isEqualTo(4);
    }

    @Test
    void aCreatorCanOpenOnlyOneRoomPerGame() {
        RoomView original = rooms.createRoom(SLUG, "creator", 4);

        assertThatThrownBy(() -> rooms.createRoom(SLUG, "creator", 4))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(rooms.joinRoom(SLUG, original.code(), "creator")).isEqualTo(original);
        // Le même compte peut ouvrir une salle pour un AUTRE jeu en parallèle.
        assertThat(rooms.createRoom("mastermind", "creator", 2).gameSlug()).isEqualTo("mastermind");
    }

    @Test
    void otherAccountsTakeTheRemainingSeatsInOrder() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();

        for (int seat = 2; seat <= 4; seat++) {
            assertThat(rooms.joinRoom(SLUG, code, "player-" + seat)).isEqualTo(new RoomView(SLUG, code, seat, seat, 4));
        }
    }

    @Test
    void theSameAccountKeepsItsSeatWithoutConsumingAnotherPlace() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        RoomView second = rooms.joinRoom(SLUG, code, "second");

        assertThat(rooms.joinRoom(SLUG, code, "second")).isEqualTo(second);
        assertThat(rooms.joinRoom(SLUG, code, "creator")).isEqualTo(new RoomView(SLUG, code, 1, 2, 4));
    }

    @Test
    void refusesAnAccountAtAFullRoom() {
        String code = rooms.createRoom(SLUG, "duel", 2).code();
        rooms.joinRoom(SLUG, code, "second");

        assertThatThrownBy(() -> rooms.joinRoom(SLUG, code, "third"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.CONFLICT));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"UNKNOWN", "  "})
    void refusesAnUnknownRoomCode(String code) {
        assertThatThrownBy(() -> rooms.joinRoom(SLUG, code, "player"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void aRoomCodeBelongingToAnotherGameIsNotFound() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();

        assertThatThrownBy(() -> rooms.joinRoom("mastermind", code, "player"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void leavingFreesTheSeatAndDeletesAnEmptyRoom() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        rooms.joinRoom(SLUG, code, "second");

        rooms.leaveRoom(SLUG, code, "creator");
        assertThat(rooms.joinRoom(SLUG, code, "creator")).isEqualTo(new RoomView(SLUG, code, 2, 2, 4));

        rooms.leaveRoom(SLUG, code, "second");
        rooms.leaveRoom(SLUG, code, "creator");
        assertThatThrownBy(() -> rooms.joinRoom(SLUG, code, "creator"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void leavingReturnsTheCanonicalSummaryOnlyWhenAccountWasActuallySeated() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();

        assertThat(rooms.leaveRoom(SLUG, code.toLowerCase(Locale.ROOT), "creator"))
                .contains(new RoomSummary(SLUG, code, 0, 4));
        assertThat(rooms.leaveRoom(SLUG, code, "creator")).isEmpty();
        assertThat(rooms.leaveRoom(SLUG, "UNKNOWN", "creator")).isEmpty();
    }

    @Test
    void leavingReportsThePlayerCountRemainingForTheOthers() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        rooms.joinRoom(SLUG, code, "second");
        rooms.joinRoom(SLUG, code, "third");

        assertThat(rooms.leaveRoom(SLUG, code, "second")).contains(new RoomSummary(SLUG, code, 2, 4));
    }

    @Test
    void leavingAnUnknownRoomOrSeatIsANoOp() {
        rooms.leaveRoom(SLUG, "UNKNOWN", "player");

        String code = rooms.createRoom(SLUG, "creator", 4).code();
        rooms.leaveRoom(SLUG, code, "never-seated");

        assertThat(rooms.joinRoom(SLUG, code, "creator")).isEqualTo(new RoomView(SLUG, code, 1, 1, 4));
    }

    @Test
    void whenTheFirstSeatLeavesTheNextPlayerInheritsTheCreatorRestriction() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        rooms.joinRoom(SLUG, code, "second");

        rooms.leaveRoom(SLUG, code, "creator");

        // "second" occupe maintenant le premier siège : il ne peut pas ouvrir une deuxième salle pour ce jeu...
        assertThatThrownBy(() -> rooms.createRoom(SLUG, "second", 4))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.CONFLICT));
        // ...tandis que l'ancien créateur, parti, peut désormais en ouvrir une nouvelle.
        assertThat(rooms.createRoom(SLUG, "creator", 4).code()).isNotEqualTo(code);
    }

    @Test
    void requireMembershipReturnsTheSeatOfAMember() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        rooms.joinRoom(SLUG, code, "second");

        assertThat(rooms.requireMembership(SLUG, code, "second")).isEqualTo(new RoomView(SLUG, code, 2, 2, 4));
    }

    @Test
    void requireMembershipRefusesAnAccountThatNeverJoined() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();

        assertThatThrownBy(() -> rooms.requireMembership(SLUG, code, "stranger"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void requireMembershipRefusesAnUnknownOrMismatchedRoom() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();

        assertThatThrownBy(() -> rooms.requireMembership(SLUG, "UNKNOWN", "creator"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> rooms.requireMembership("mastermind", code, "creator"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void findsTheRoomAnAccountIsSeatedIn() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();
        rooms.createRoom("mastermind", "other-account", 2);

        assertThat(rooms.findRoomOf(SLUG, "creator")).contains(new RoomView(SLUG, code, 1, 1, 4));
        assertThat(rooms.findRoomOf(SLUG, "nobody")).isEqualTo(Optional.empty());
        assertThat(rooms.findRoomOf("mastermind", "creator")).isEqualTo(Optional.empty());
    }

    @Test
    void theNumberOfStoredRoomsIsBoundedGlobally() {
        RoomView first = rooms.createRoom(SLUG, "creator-0", 4);
        for (int account = 1; account < GameRoomService.MAX_ROOMS; account++) {
            rooms.createRoom(SLUG, "creator-" + account, 4);
        }

        assertThatThrownBy(() -> rooms.createRoom(SLUG, "one-too-many", 4))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        assertThat(rooms.joinRoom(SLUG, first.code(), "creator-0")).isEqualTo(first);
    }

    @Test
    void anInactiveRoomIsRemovedAndItsCreatorCanOpenANewOne() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();

        clock.advance(GameRoomService.INACTIVITY_TIMEOUT);

        assertThatThrownBy(() -> rooms.joinRoom(SLUG, code, "creator"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThat(rooms.createRoom(SLUG, "creator", 4).code()).isNotEqualTo(code);
    }

    @Test
    void joiningKeepsARoomAlive() {
        String code = rooms.createRoom(SLUG, "creator", 4).code();

        clock.advance(GameRoomService.INACTIVITY_TIMEOUT.minusMinutes(1));
        rooms.joinRoom(SLUG, code, "second");
        clock.advance(GameRoomService.INACTIVITY_TIMEOUT.minusMinutes(1));

        assertThat(rooms.joinRoom(SLUG, code, "creator")).isEqualTo(new RoomView(SLUG, code, 1, 2, 4));
    }

    @Test
    void aRefusedJoinAtAFullRoomDoesNotKeepItAlive() {
        String code = rooms.createRoom(SLUG, "creator", 2).code();
        rooms.joinRoom(SLUG, code, "second");

        clock.advance(GameRoomService.INACTIVITY_TIMEOUT.minusMinutes(1));
        assertThatThrownBy(() -> rooms.joinRoom(SLUG, code, "third")).isInstanceOf(GameRoomException.class);
        clock.advance(Duration.ofMinutes(1));

        assertThatThrownBy(() -> rooms.joinRoom(SLUG, code, "creator"))
                .isInstanceOfSatisfying(
                        GameRoomException.class,
                        error -> assertThat(error.status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void onlyOneOfManyConcurrentAccountsCanTakeTheLastSeat() throws Exception {
        int contenders = 8;
        try (var executor = Executors.newFixedThreadPool(contenders)) {
            for (int round = 0; round < 50; round++) {
                String creator = "creator-" + round;
                String code = rooms.createRoom(SLUG, creator, 2).code();
                CountDownLatch ready = new CountDownLatch(contenders);
                AtomicBoolean start = new AtomicBoolean();
                List<Future<RoomView>> attempts = new ArrayList<>();
                for (int account = 0; account < contenders; account++) {
                    String accountId = "challenger-" + account;
                    attempts.add(executor.submit(() -> {
                        ready.countDown();
                        while (!start.get()) Thread.onSpinWait();
                        try {
                            return rooms.joinRoom(SLUG, code, accountId);
                        } catch (GameRoomException error) {
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

                List<RoomView> accepted = new ArrayList<>();
                for (Future<RoomView> attempt : attempts) {
                    RoomView seat = attempt.get(5, TimeUnit.SECONDS);
                    if (seat != null) accepted.add(seat);
                }
                assertThat(accepted).as("round %s", round).containsExactly(new RoomView(SLUG, code, 2, 2, 2));
            }
        }
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
