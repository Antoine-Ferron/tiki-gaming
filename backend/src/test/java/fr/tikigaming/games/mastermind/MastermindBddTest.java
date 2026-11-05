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

/** Scénarios exécutables correspondant à docs/games/mastermind/mastermind.feature. */
class MastermindBddTest {
    private static final String CLIENT = "198.51.100.10";
    private static final List<MastermindColor> SECRET =
            List.of(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.GREEN, MastermindColor.YELLOW);
    private static final List<MastermindColor> WRONG =
            List.of(MastermindColor.ORANGE, MastermindColor.ORANGE, MastermindColor.ORANGE, MastermindColor.ORANGE);

    @Test
    void victoireDesLaPremiereProposition() {
        MastermindGame game = new MastermindGame(UUID.randomUUID(), SECRET);

        assertThat(game.guess(SECRET).status()).isEqualTo(MastermindStatus.WON);
        assertThat(game.snapshot().score()).isEqualTo(10);
    }

    @Test
    void defaiteApresDixPropositionsIncorrectes() {
        MastermindGame game = new MastermindGame(UUID.randomUUID(), SECRET);

        for (int attempt = 0; attempt < MastermindGame.MAX_ATTEMPTS; attempt++) game.guess(WRONG);

        assertThat(game.snapshot().status()).isEqualTo(MastermindStatus.LOST);
        assertThat(game.snapshot().secret()).containsExactlyElementsOf(SECRET);
    }

    @Test
    void couleursRepetees() {
        MastermindFeedback feedback = MastermindGame.evaluate(
                List.of(MastermindColor.RED, MastermindColor.RED, MastermindColor.BLUE, MastermindColor.BLUE),
                List.of(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.RED, MastermindColor.BLUE));

        assertThat(feedback).isEqualTo(new MastermindFeedback(2, 2));
    }

    @Test
    void partieExpiree() {
        MutableClock clock = new MutableClock();
        MastermindService service = new MastermindService(clock);
        UUID id = service.create(CLIENT).id();

        clock.advance(MastermindService.UNPLAYED_TIMEOUT_MILLIS);

        assertThatThrownBy(() -> service.get(id)).isInstanceOf(MastermindNotFoundException.class);
    }

    @Test
    void redemarrage() {
        MastermindGame game = new MastermindGame(UUID.randomUUID(), SECRET);
        game.guess(WRONG);

        game.restart(List.of(
                MastermindColor.PURPLE, MastermindColor.PURPLE, MastermindColor.PURPLE, MastermindColor.PURPLE));

        assertThat(game.snapshot().history()).isEmpty();
        assertThat(game.snapshot().secret()).isNull();
        assertThat(game.guess(WRONG).attemptsUsed()).isEqualTo(1);
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-05T00:00:00Z");

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
