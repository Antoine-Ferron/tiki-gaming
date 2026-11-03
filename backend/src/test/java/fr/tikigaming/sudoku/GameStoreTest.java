package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.Random;
import org.junit.jupiter.api.Test;

/** Le temps des parties vient d'une horloge figée : expiration testée sans sleep. */
class GameStoreTest {

    private final FixedClock clock = new FixedClock(Instant.parse("2026-11-03T10:00:00Z"));
    private final GameStore store = new GameStore(clock);
    private final SudokuGenerator.Puzzle grids = new SudokuGenerator(new Random(5)).generate(Difficulty.EASY);

    @Test
    void startedGameIsFoundWithItsDifficultyAndPuzzle() {
        GameStore.Game game = store.start(Difficulty.EASY, grids);

        GameStore.Game found = store.find(game.id());

        assertThat(found.difficulty()).isEqualTo(Difficulty.EASY);
        assertThat(found.puzzle()).isEqualTo(grids.puzzle());
    }

    @Test
    void eachGameGetsItsOwnId() {
        assertThat(store.start(Difficulty.EASY, grids).id())
                .isNotEqualTo(store.start(Difficulty.EASY, grids).id());
    }

    @Test
    void elapsedTimeComesFromServerClockSinceStart() {
        GameStore.Game game = store.start(Difficulty.EASY, grids);

        clock.advance(Duration.ofSeconds(42));

        assertThat(game.elapsedSeconds()).isEqualTo(42);
    }

    @Test
    void puzzleAccessorReturnsACopy() {
        GameStore.Game game = store.start(Difficulty.EASY, grids);

        game.puzzle()[0] = 99;

        assertThat(game.puzzle()).isEqualTo(grids.puzzle());
    }

    @Test
    void gameIsStillValidAtTtlAndExpiredJustAfter() {
        GameStore.Game game = store.start(Difficulty.EASY, grids);

        clock.advance(Duration.ofSeconds(GameStore.TTL_SECONDS));
        assertThat(store.find(game.id())).isSameAs(game);

        clock.advance(Duration.ofSeconds(1));
        assertThatThrownBy(() -> store.find(game.id())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void finishedGameIsGone() {
        GameStore.Game game = store.start(Difficulty.EASY, grids);

        store.finish(game.id());

        assertThatThrownBy(() -> store.find(game.id())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unknownOrNullIdIsRejected() {
        assertThatThrownBy(() -> store.find("x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> store.find(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void openGamesAreCappedButExpiredOnesAreReclaimed() {
        for (int i = 0; i < GameStore.MAX_GAMES; i++) store.start(Difficulty.EASY, grids);

        assertThatThrownBy(() -> store.start(Difficulty.EASY, grids)).isInstanceOf(IllegalStateException.class);

        clock.advance(Duration.ofSeconds(GameStore.TTL_SECONDS + 1));
        assertThat(store.start(Difficulty.EASY, grids)).isNotNull();
    }
}
