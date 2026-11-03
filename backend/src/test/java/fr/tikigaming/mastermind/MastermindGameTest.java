package fr.tikigaming.mastermind;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class MastermindGameTest {
    private static final List<MastermindColor> SECRET =
            List.of(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.GREEN, MastermindColor.YELLOW);

    @Test
    void startsWithTenAttemptsAndInProgressStatus() {
        MastermindGame game = game();

        assertThat(game.snapshot().status()).isEqualTo(MastermindStatus.IN_PROGRESS);
        assertThat(game.snapshot().attemptsUsed()).isZero();
        assertThat(game.snapshot().attemptsRemaining()).isEqualTo(10);
        assertThat(game.snapshot().history()).isEmpty();
        assertThat(game.snapshot().secret()).isNull();
    }

    @ParameterizedTest
    @MethodSource("feedbackCases")
    void calculatesFeedbackIncludingRepeatedColors(
            List<MastermindColor> secret, List<MastermindColor> guess, int exact, int misplaced) {
        assertThat(MastermindGame.evaluate(secret, guess)).isEqualTo(new MastermindFeedback(exact, misplaced));
    }

    static List<Arguments> feedbackCases() {
        return List.of(
                Arguments.of(SECRET, SECRET, 4, 0),
                Arguments.of(
                        SECRET,
                        List.of(
                                MastermindColor.BLUE,
                                MastermindColor.RED,
                                MastermindColor.YELLOW,
                                MastermindColor.GREEN),
                        0,
                        4),
                Arguments.of(
                        SECRET,
                        List.of(
                                MastermindColor.RED,
                                MastermindColor.GREEN,
                                MastermindColor.ORANGE,
                                MastermindColor.BLUE),
                        1,
                        2),
                Arguments.of(
                        SECRET,
                        List.of(
                                MastermindColor.ORANGE,
                                MastermindColor.PURPLE,
                                MastermindColor.ORANGE,
                                MastermindColor.PURPLE),
                        0,
                        0),
                Arguments.of(
                        SECRET,
                        List.of(
                                MastermindColor.RED,
                                MastermindColor.ORANGE,
                                MastermindColor.PURPLE,
                                MastermindColor.ORANGE),
                        1,
                        0),
                Arguments.of(
                        SECRET,
                        List.of(
                                MastermindColor.RED,
                                MastermindColor.BLUE,
                                MastermindColor.ORANGE,
                                MastermindColor.PURPLE),
                        2,
                        0),
                Arguments.of(
                        SECRET,
                        List.of(
                                MastermindColor.BLUE,
                                MastermindColor.RED,
                                MastermindColor.GREEN,
                                MastermindColor.YELLOW),
                        2,
                        2),
                Arguments.of(
                        List.of(MastermindColor.RED, MastermindColor.RED, MastermindColor.BLUE, MastermindColor.BLUE),
                        List.of(MastermindColor.RED, MastermindColor.RED, MastermindColor.RED, MastermindColor.RED),
                        2,
                        0),
                Arguments.of(
                        List.of(MastermindColor.RED, MastermindColor.RED, MastermindColor.BLUE, MastermindColor.BLUE),
                        List.of(MastermindColor.BLUE, MastermindColor.BLUE, MastermindColor.BLUE, MastermindColor.BLUE),
                        2,
                        0),
                Arguments.of(
                        List.of(MastermindColor.RED, MastermindColor.RED, MastermindColor.BLUE, MastermindColor.BLUE),
                        List.of(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.RED, MastermindColor.BLUE),
                        2,
                        2),
                Arguments.of(
                        List.of(MastermindColor.RED, MastermindColor.RED, MastermindColor.BLUE, MastermindColor.BLUE),
                        List.of(
                                MastermindColor.GREEN,
                                MastermindColor.GREEN,
                                MastermindColor.GREEN,
                                MastermindColor.GREEN),
                        0,
                        0));
    }

    @Test
    void acceptsValidGuessAndIncrementsAttempts() {
        MastermindGame game = game();

        MastermindGameSnapshot result =
                game.guess(List.of(MastermindColor.RED, MastermindColor.RED, MastermindColor.RED, MastermindColor.RED));

        assertThat(result.attemptsUsed()).isEqualTo(1);
        assertThat(result.attemptsRemaining()).isEqualTo(9);
        assertThat(result.history()).hasSize(1);
    }

    @ParameterizedTest
    @MethodSource("invalidGuesses")
    void rejectsInvalidGuessWithoutIncrementingAttempts(List<MastermindColor> guess) {
        MastermindGame game = game();

        assertThatThrownBy(() -> game.guess(guess)).isInstanceOf(MastermindValidationException.class);
        assertThat(game.snapshot().attemptsUsed()).isZero();
    }

    static List<Arguments> invalidGuesses() {
        return List.of(
                Arguments.of(List.of(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.GREEN)),
                Arguments.of(List.of(
                        MastermindColor.RED,
                        MastermindColor.BLUE,
                        MastermindColor.GREEN,
                        MastermindColor.YELLOW,
                        MastermindColor.ORANGE)),
                Arguments.of(List.of()),
                Arguments.of(Arrays.asList(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.GREEN, null)));
    }

    @Test
    void winsOnTheFirstGuessAndRejectsFurtherGuesses() {
        MastermindGame game = game();

        assertThat(game.guess(SECRET).status()).isEqualTo(MastermindStatus.WON);
        assertThat(game.snapshot().secret()).containsExactlyElementsOf(SECRET);
        assertThat(game.snapshot().score()).isEqualTo(10);
        assertThatThrownBy(() -> game.guess(SECRET)).isInstanceOf(MastermindFinishedException.class);
    }

    @Test
    void losesAfterTenIncorrectGuessesAndRejectsTheEleventh() {
        MastermindGame game = game();
        List<MastermindColor> incorrect =
                List.of(MastermindColor.ORANGE, MastermindColor.ORANGE, MastermindColor.ORANGE, MastermindColor.ORANGE);

        for (int attempt = 0; attempt < 10; attempt++) game.guess(incorrect);

        assertThat(game.snapshot().status()).isEqualTo(MastermindStatus.LOST);
        assertThat(game.snapshot().attemptsRemaining()).isZero();
        assertThatThrownBy(() -> game.guess(incorrect)).isInstanceOf(MastermindFinishedException.class);
    }

    @Test
    void restartResetsStateAndHidesTheNewSecret() {
        MastermindGame game = game();
        game.guess(List.of(
                MastermindColor.ORANGE, MastermindColor.ORANGE, MastermindColor.ORANGE, MastermindColor.ORANGE));

        game.restart(List.of(
                MastermindColor.PURPLE, MastermindColor.PURPLE, MastermindColor.PURPLE, MastermindColor.PURPLE));

        assertThat(game.snapshot().status()).isEqualTo(MastermindStatus.IN_PROGRESS);
        assertThat(game.snapshot().attemptsUsed()).isZero();
        assertThat(game.snapshot().history()).isEmpty();
        assertThat(game.snapshot().secret()).isNull();
    }

    private static MastermindGame game() {
        return new MastermindGame(UUID.randomUUID(), SECRET);
    }
}
