package fr.tikigaming.games.mastermind;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MastermindServiceTest {
    private static final String CLIENT = "203.0.113.1";
    private static final List<MastermindColor> GUESS =
            List.of(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.GREEN, MastermindColor.YELLOW);

    private final MutableClock clock = new MutableClock();
    private final MastermindService service = new MastermindService(clock);

    @Test
    void createsAndLoadsGame() {
        MastermindGameSnapshot created = service.create(CLIENT);

        assertThat(service.get(created.id())).isEqualTo(created);
    }

    @Test
    void delegatesGuessAndRestartToGame() {
        UUID id = service.create(CLIENT).id();

        assertThat(service.guess(id, GUESS).attemptsUsed()).isEqualTo(1);
        assertThat(service.restart(id).attemptsUsed()).isZero();
    }

    @Test
    void rejectsUnknownGame() {
        assertThatThrownBy(() -> service.get(UUID.randomUUID())).isInstanceOf(MastermindNotFoundException.class);
    }

    @Test
    void limitsActiveGamesPerClient() {
        for (int i = 0; i < MastermindService.MAX_GAMES_PER_CLIENT; i++) service.create(CLIENT);

        assertThatThrownBy(() -> service.create(CLIENT)).isInstanceOf(MastermindCapacityException.class);
        assertThat(service.create("203.0.113.2")).isNotNull();
    }

    @Test
    void limitsActiveGamesOverall() {
        for (int i = 0; i < MastermindService.MAX_ACTIVE_GAMES; i++) service.create("client-" + i);

        assertThatThrownBy(() -> service.create(CLIENT)).isInstanceOf(MastermindCapacityException.class);
    }

    @Test
    void expiresUnplayedGameQuickly() {
        UUID id = service.create(CLIENT).id();

        clock.advance(MastermindService.UNPLAYED_TIMEOUT_MILLIS - 1);
        assertThat(service.get(id)).isNotNull();
        clock.advance(MastermindService.UNPLAYED_TIMEOUT_MILLIS);

        assertThatThrownBy(() -> service.get(id)).isInstanceOf(MastermindNotFoundException.class);
    }

    @Test
    void keepsPlayedGameUntilInactivityTimeout() {
        UUID id = service.create(CLIENT).id();
        service.guess(id, GUESS);

        clock.advance(MastermindService.INACTIVITY_TIMEOUT_MILLIS - 1);
        service.purgeExpired();
        assertThat(service.activeGames()).isOne();
        clock.advance(1);
        service.purgeExpired();

        assertThat(service.activeGames()).isZero();
    }

    @Test
    void expiredGamesFreeTheirPlaceForTheClient() {
        for (int i = 0; i < MastermindService.MAX_GAMES_PER_CLIENT; i++) service.create(CLIENT);

        clock.advance(MastermindService.UNPLAYED_TIMEOUT_MILLIS);

        assertThat(service.create(CLIENT)).isNotNull();
        assertThat(service.activeGames()).isOne();
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-03T12:00:00Z");

        void advance(long millis) {
            now = now.plusMillis(millis);
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
