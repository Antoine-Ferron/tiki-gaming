package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class SudokuGeneratorTest {

    @ParameterizedTest
    @EnumSource(Difficulty.class)
    void generatesUniquelySolvablePuzzleWithExpectedClues(Difficulty difficulty) {
        SudokuGenerator.Puzzle result = new SudokuGenerator(new Random(42)).generate(difficulty);

        long clues = Arrays.stream(result.puzzle()).filter(v -> v != 0).count();
        assertThat(clues).isEqualTo(difficulty.clues());
        assertThat(SudokuSolver.countSolutions(result.puzzle(), 2)).isEqualTo(1);
    }

    @Test
    void solutionIsCompleteValidAndMatchesPuzzleClues() {
        SudokuGenerator.Puzzle result = new SudokuGenerator(new Random(7)).generate(Difficulty.EASY);

        assertThat(result.solution()).doesNotContain(0);
        assertThat(SudokuSolver.findConflicts(result.solution())).isEmpty();
        for (int i = 0; i < SudokuSolver.CELLS; i++) {
            if (result.puzzle()[i] != 0) assertThat(result.puzzle()[i]).isEqualTo(result.solution()[i]);
        }
    }

    @Test
    void sameSeedGivesSamePuzzle() {
        int[] a = new SudokuGenerator(new Random(5)).generate(Difficulty.MEDIUM).puzzle();
        int[] b = new SudokuGenerator(new Random(5)).generate(Difficulty.MEDIUM).puzzle();

        assertThat(a).isEqualTo(b);
    }

    @Test
    void harderLevelsLeaveFewerClues() {
        assertThat(Difficulty.EASY.clues()).isGreaterThan(Difficulty.MEDIUM.clues());
        assertThat(Difficulty.MEDIUM.clues()).isGreaterThan(Difficulty.HARD.clues());
    }
}
