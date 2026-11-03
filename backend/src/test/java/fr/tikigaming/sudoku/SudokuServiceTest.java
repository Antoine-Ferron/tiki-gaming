package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SudokuServiceTest {

    private final SudokuService service = new SudokuService();
    private SudokuGenerator.Puzzle game;

    @BeforeEach
    void setUp() {
        game = new SudokuGenerator(new Random(3)).generate(Difficulty.EASY);
    }

    @Test
    void solvedGridIsAcceptedWithScore() {
        SudokuService.CheckResult result = service.check(game.puzzle(), game.solution(), Difficulty.EASY, 120, 1);

        assertThat(result.complete()).isTrue();
        assertThat(result.solved()).isTrue();
        assertThat(result.conflicts()).isEmpty();
        // 480 s gagnées sur 600 : 120 x 1 + 120 x 2 + 240 x 3 = 1080 ; une erreur : pas de bonus « sans faute », -50
        assertThat(result.score()).isEqualTo(1000 + 1080 - 50);
        assertThat(result.breakdown().timeBonus()).isEqualTo(1080);
    }

    @Test
    void incompleteGridIsNotSolvedAndScoresZero() {
        SudokuService.CheckResult result = service.check(game.puzzle(), game.puzzle(), Difficulty.EASY, 10, 0);

        assertThat(result.complete()).isFalse();
        assertThat(result.solved()).isFalse();
        assertThat(result.score()).isZero();
    }

    @Test
    void completeGridWithConflictIsNotSolved() {
        int[] values = game.solution().clone();
        int editable = firstEditableCell();
        values[editable] = values[editable] % 9 + 1;

        SudokuService.CheckResult result = service.check(game.puzzle(), values, Difficulty.EASY, 10, 0);

        assertThat(result.complete()).isTrue();
        assertThat(result.solved()).isFalse();
        assertThat(result.conflicts()).contains(editable);
        assertThat(result.score()).isZero();
    }

    @Test
    void rejectsModifiedClue() {
        int[] values = game.solution().clone();
        int clue = firstClueCell();
        values[clue] = values[clue] % 9 + 1;

        assertThatThrownBy(() -> service.check(game.puzzle(), values, Difficulty.EASY, 10, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("indice de départ");
    }

    @Test
    void rejectsMalformedGrids() {
        assertThatThrownBy(() -> service.check(new int[10], game.solution(), Difficulty.EASY, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.check(game.puzzle(), null, Difficulty.EASY, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
        int[] outOfRange = game.puzzle().clone();
        outOfRange[firstEditableCell()] = 10;
        assertThatThrownBy(() -> service.check(game.puzzle(), outOfRange, Difficulty.EASY, 0, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNegativeTimeOrMistakes() {
        assertThatThrownBy(() -> service.check(game.puzzle(), game.solution(), Difficulty.EASY, -1, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.check(game.puzzle(), game.solution(), Difficulty.EASY, 0, -1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private int firstEditableCell() {
        for (int i = 0; i < game.puzzle().length; i++) {
            if (game.puzzle()[i] == 0) {
                return i;
            }
        }
        throw new IllegalStateException();
    }

    private int firstClueCell() {
        for (int i = 0; i < game.puzzle().length; i++) {
            if (game.puzzle()[i] != 0) {
                return i;
            }
        }
        throw new IllegalStateException();
    }
}
