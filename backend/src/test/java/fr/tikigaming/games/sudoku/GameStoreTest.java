package fr.tikigaming.games.sudoku;

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
        GameStore.Game game = store.start("a", Difficulty.EASY, grids);

        GameStore.Game found = store.find(game.id());

        assertThat(found.difficulty()).isEqualTo(Difficulty.EASY);
        assertThat(found.puzzle()).isEqualTo(grids.puzzle());
    }

    @Test
    void eachGameGetsItsOwnId() {
        assertThat(store.start("a", Difficulty.EASY, grids).id())
                .isNotEqualTo(store.start("a", Difficulty.EASY, grids).id());
    }

    @Test
    void elapsedTimeComesFromServerClockSinceStart() {
        GameStore.Game game = store.start("a", Difficulty.EASY, grids);

        clock.advance(Duration.ofSeconds(42));

        assertThat(game.elapsedSeconds()).isEqualTo(42);
    }

    @Test
    void puzzleAccessorReturnsACopy() {
        GameStore.Game game = store.start("a", Difficulty.EASY, grids);

        game.puzzle()[0] = 99;

        assertThat(game.puzzle()).isEqualTo(grids.puzzle());
    }

    @Test
    void gameIsStillValidAtTtlAndExpiredJustAfter() {
        GameStore.Game game = store.start("a", Difficulty.EASY, grids);

        clock.advance(Duration.ofSeconds(GameStore.TTL_SECONDS));
        assertThat(store.find(game.id())).isSameAs(game);

        clock.advance(Duration.ofSeconds(1));
        assertThatThrownBy(() -> store.find(game.id())).isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void finishedGameIsGone() {
        GameStore.Game game = store.start("a", Difficulty.EASY, grids);

        store.finish(game.id());

        assertThatThrownBy(() -> store.find(game.id())).isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void unknownOrNullIdIsRejected() {
        assertThatThrownBy(() -> store.find("x")).isInstanceOf(SudokuBadRequestException.class);
        assertThatThrownBy(() -> store.find(null)).isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void openingTooManyGamesEvictsTheOwnersOldestOne() {
        GameStore.Game oldest = store.start("a", Difficulty.EASY, grids);
        for (int i = 1; i < GameStore.MAX_PER_OWNER; i++) store.start("a", Difficulty.EASY, grids);
        GameStore.Game other = store.start("b", Difficulty.EASY, grids);

        GameStore.Game newest = store.start("a", Difficulty.EASY, grids);

        assertThatThrownBy(() -> store.find(oldest.id())).isInstanceOf(SudokuBadRequestException.class);
        assertThat(store.find(newest.id())).isSameAs(newest);
        assertThat(store.find(other.id())).isSameAs(other);
    }

    @Test
    void aFloodFromOneOwnerNeverBlocksNorEvictsOtherPlayers() {
        GameStore.Game player = store.start("joueur", Difficulty.EASY, grids);

        for (int i = 0; i < 1000; i++) store.start("script", Difficulty.EASY, grids);

        assertThat(store.find(player.id())).isSameAs(player);
    }

    @Test
    void fullStoreEvictsTheOldestGameInsteadOfRefusingTheNewOne() {
        GameStore.Game oldest = store.start("o0", Difficulty.EASY, grids);
        for (int i = 1; i < GameStore.MAX_GAMES; i++) store.start("o" + i, Difficulty.EASY, grids);

        GameStore.Game newest = store.start("nouveau", Difficulty.EASY, grids);

        assertThatThrownBy(() -> store.find(oldest.id())).isInstanceOf(SudokuBadRequestException.class);
        assertThat(store.find(newest.id())).isSameAs(newest);
    }

    @Test
    void fullStoreReclaimsExpiredGamesBeforeEvictingLiveOnes() {
        GameStore.Game old = store.start("o0", Difficulty.EASY, grids);
        clock.advance(Duration.ofSeconds(GameStore.TTL_SECONDS + 1));
        GameStore.Game live = store.start("o1", Difficulty.EASY, grids);
        for (int i = 2; i < GameStore.MAX_GAMES; i++) store.start("o" + i, Difficulty.EASY, grids);

        store.start("nouveau", Difficulty.EASY, grids);

        assertThat(store.find(live.id())).isSameAs(live);
        assertThatThrownBy(() -> store.find(old.id())).isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void aGameIsLostOnlyOnceMistakesExceedTheLimit() {
        GameStore.Game game = store.start("owner", Difficulty.EASY, grids);
        int cell = emptyCell();
        int wrong = grids.solution()[cell] % 9 + 1;

        for (int i = 1; i <= GameStore.MAX_MISTAKES; i++) {
            assertThat(game.play(cell, wrong).lost()).as("erreur %d", i).isFalse();
            assertThat(game.isLost()).isFalse();
        }
        GameStore.MoveResult fatal = game.play(cell, wrong);

        assertThat(fatal.lost()).isTrue();
        assertThat(game.isLost()).isTrue();
        assertThat(fatal.mistakes()).isEqualTo(GameStore.MAX_MISTAKES + 1);
    }

    @Test
    void aCorrectMoveNeverCountsTowardTheLimit() {
        GameStore.Game game = store.start("owner", Difficulty.EASY, grids);
        int cell = emptyCell();

        GameStore.MoveResult result = game.play(cell, grids.solution()[cell]);

        assertThat(result.correct()).isTrue();
        assertThat(result.lost()).isFalse();
        assertThat(game.mistakes()).isZero();
    }

    @Test
    void aLostGameRefusesAnyMoveAndKeepsItsGrid() {
        GameStore.Game game = store.start("owner", Difficulty.EASY, grids);
        int cell = emptyCell();
        for (int i = 0; i <= GameStore.MAX_MISTAKES; i++) {
            game.play(cell, grids.solution()[cell] % 9 + 1);
        }

        assertThatThrownBy(() -> game.play(cell, grids.solution()[cell])).isInstanceOf(SudokuGameOverException.class);
        assertThat(game.values()[cell]).isZero();
        assertThat(game.mistakes()).isEqualTo(GameStore.MAX_MISTAKES + 1);
    }

    private int emptyCell() {
        for (int i = 0; i < SudokuSolver.CELLS; i++) {
            if (grids.puzzle()[i] == 0) {
                return i;
            }
        }
        throw new IllegalStateException("grille pleine");
    }
}
