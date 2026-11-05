package fr.tikigaming.games.dame.matches;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Player;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class MatchTest {

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000018");
    private static final Instant START = Instant.parse("2026-11-04T12:00:00Z");
    private static final Instant END = START.plusSeconds(600);

    @Test
    void startsWithTheTwoNamesAndNoResult() {
        Match match = Match.start(ID, "Cherif", "Amadou", START);

        assertThat(match.id()).isEqualTo(ID);
        assertThat(match.whiteName()).isEqualTo("Cherif");
        assertThat(match.blackName()).isEqualTo("Amadou");
        assertThat(match.startedAt()).isEqualTo(START);
        assertThat(match.status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(match.finishedAt()).isNull();
        assertThat(match.winner()).isEmpty();
    }

    @Test
    void stripsOuterWhitespaceAndPreservesAccentsAndInnerSpaces() {
        Match match = Match.start(ID, " \tChérif Diallo\n", "\u2003Élodie\u2003", START);

        assertThat(match.whiteName()).isEqualTo("Chérif Diallo");
        assertThat(match.blackName()).isEqualTo("Élodie");
    }

    @Test
    void acceptsTwoParticipantsWithTheSameDisplayName() {
        Match match = Match.start(ID, "Alex", "Alex", START);

        assertThat(match.whiteName()).isEqualTo("Alex");
        assertThat(match.blackName()).isEqualTo("Alex");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t\n", "\u2003"})
    void rejectsAMissingWhiteName(String name) {
        assertThatThrownBy(() -> Match.start(ID, name, "Amadou", START)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t\n", "\u2003"})
    void rejectsAMissingBlackName(String name) {
        assertThatThrownBy(() -> Match.start(ID, "Cherif", name, START)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 50})
    void acceptsNamesAtBothLengthBoundariesAfterTrimming(int length) {
        String name = "é".repeat(length);

        Match match = Match.start(ID, " " + name + " ", " " + name + " ", START);

        assertThat(match.whiteName()).isEqualTo(name);
        assertThat(match.blackName()).isEqualTo(name);
    }

    @Test
    void rejectsAWhiteNameBeyondFiftyCharacters() {
        assertThatThrownBy(() -> Match.start(ID, "a".repeat(51), "Amadou", START))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsABlackNameBeyondFiftyCharacters() {
        assertThatThrownBy(() -> Match.start(ID, "Cherif", "a".repeat(51), START))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void measuresTheDocumentedUtf16Limit() {
        String name = "\uD83D\uDE00".repeat(25);

        assertThat(Match.start(ID, name, name, START).whiteName()).isEqualTo(name);
        assertThatThrownBy(() -> Match.start(ID, name + "a", "Amadou", START))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @CsvSource({"WHITE_WON, WHITE", "BLACK_WON, BLACK"})
    void finishesWithTheWinningCampWithoutChangingTheOriginal(GameStatus result, Player winner) {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);

        Match finished = initial.finish(result, END);

        assertThat(finished).isNotSameAs(initial);
        assertThat(finished).isEqualTo(new Match(ID, "Cherif", "Amadou", START, result, END));
        assertThat(finished.winner()).contains(winner);
        assertThat(initial.status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(initial.finishedAt()).isNull();
    }

    @Test
    void allowsAResultAtTheExactStartingInstant() {
        Match finished = Match.start(ID, "Cherif", "Amadou", START).finish(GameStatus.WHITE_WON, START);

        assertThat(finished.status()).isEqualTo(GameStatus.WHITE_WON);
        assertThat(finished.finishedAt()).isEqualTo(START);
    }

    @Test
    void refusesAnEndBeforeTheStart() {
        Match match = Match.start(ID, "Cherif", "Amadou", START);

        assertThatThrownBy(() -> match.finish(GameStatus.WHITE_WON, START.minusNanos(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(match.status()).isEqualTo(GameStatus.IN_PROGRESS);
    }

    @ParameterizedTest
    @ValueSource(strings = {"WHITE_WON", "BLACK_WON"})
    void cannotReplaceAnExistingResult(GameStatus firstResult) {
        Match finished = new Match(ID, "Cherif", "Amadou", START, firstResult, END);

        assertThatThrownBy(() -> finished.finish(GameStatus.BLACK_WON, END.plusSeconds(1)))
                .isInstanceOf(IllegalStateException.class);
        assertThat(finished.status()).isEqualTo(firstResult);
        assertThat(finished.finishedAt()).isEqualTo(END);
    }

    @Test
    void cannotFinishWithAnInProgressStatus() {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);

        assertThatThrownBy(() -> initial.finish(GameStatus.IN_PROGRESS, END))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void anUnfinishedResultIsRejectedEvenWhenTheEndDateIsMissing() {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);

        assertThatThrownBy(() -> initial.finish(GameStatus.IN_PROGRESS, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void cannotFinishWithoutAResult() {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);

        assertThatThrownBy(() -> initial.finish(null, END)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void cannotFinishWithoutADate() {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);

        assertThatThrownBy(() -> initial.finish(GameStatus.WHITE_WON, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aRestoredMatchCannotBeInProgressWithAnEndDate() {
        assertThatThrownBy(() -> new Match(ID, "Cherif", "Amadou", START, GameStatus.IN_PROGRESS, END))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"WHITE_WON", "BLACK_WON"})
    void aRestoredFinishedMatchRequiresAnEndDate(GameStatus result) {
        assertThatThrownBy(() -> new Match(ID, "Cherif", "Amadou", START, result, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aRestoredFinishedMatchCannotEndBeforeItStarted() {
        assertThatThrownBy(() -> new Match(ID, "Cherif", "Amadou", START, GameStatus.WHITE_WON, START.minusNanos(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aRestoredMatchAlsoNormalizesAndValidatesNames() {
        Match match = new Match(ID, " Cherif ", " Amadou ", START, GameStatus.IN_PROGRESS, null);

        assertThat(match.whiteName()).isEqualTo("Cherif");
        assertThat(match.blackName()).isEqualTo("Amadou");
        assertThatThrownBy(() -> new Match(ID, " ", "Amadou", START, GameStatus.IN_PROGRESS, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void anIdIsRequired() {
        assertThatThrownBy(() -> Match.start(null, "Cherif", "Amadou", START)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void aStartingDateIsRequired() {
        assertThatThrownBy(() -> Match.start(ID, "Cherif", "Amadou", null)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void aStatusIsRequiredWhenRestoringAMatch() {
        assertThatThrownBy(() -> new Match(ID, "Cherif", "Amadou", START, null, null))
                .isInstanceOf(NullPointerException.class);
    }
}
