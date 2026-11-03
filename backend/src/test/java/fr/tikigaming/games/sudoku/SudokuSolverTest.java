package fr.tikigaming.games.sudoku;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Random;
import org.junit.jupiter.api.Test;

class SudokuSolverTest {

    @Test
    void solveFillsEmptyGridWithValidSolution() {
        int[] grid = new int[SudokuSolver.CELLS];

        assertThat(SudokuSolver.solve(grid, new Random(1))).isTrue();

        assertThat(grid).doesNotContain(0);
        assertThat(SudokuSolver.findConflicts(grid)).isEmpty();
    }

    @Test
    void solveIsDeterministicWithoutRandom() {
        int[] a = new int[SudokuSolver.CELLS];
        int[] b = new int[SudokuSolver.CELLS];

        SudokuSolver.solve(a, null);
        SudokuSolver.solve(b, null);

        assertThat(a).isEqualTo(b);
        assertThat(a[0]).isEqualTo(1);
    }

    @Test
    void placementRejectsDuplicateInRowColumnAndBlock() {
        int[] grid = new int[SudokuSolver.CELLS];
        grid[0] = 5;

        assertThat(SudokuSolver.isValidPlacement(grid, 8, 5)).isFalse(); // même ligne
        assertThat(SudokuSolver.isValidPlacement(grid, 72, 5)).isFalse(); // même colonne
        assertThat(SudokuSolver.isValidPlacement(grid, 10, 5)).isFalse(); // même bloc
        assertThat(SudokuSolver.isValidPlacement(grid, 40, 5)).isTrue(); // case libre
    }

    @Test
    void placementIgnoresTheCellItself() {
        int[] grid = new int[SudokuSolver.CELLS];
        grid[0] = 5;

        assertThat(SudokuSolver.isValidPlacement(grid, 0, 5)).isTrue();
    }

    @Test
    void findConflictsReportsBothCellsOfADuplicate() {
        int[] grid = new int[SudokuSolver.CELLS];
        grid[0] = 3;
        grid[4] = 3;

        assertThat(SudokuSolver.findConflicts(grid)).containsExactly(0, 4);
    }

    @Test
    void countSolutionsStopsAtLimitAndLeavesGridUntouched() {
        int[] grid = new int[SudokuSolver.CELLS];

        assertThat(SudokuSolver.countSolutions(grid, 2)).isEqualTo(2);
        assertThat(grid).containsOnly(0);
    }

    @Test
    void countSolutionsFindsOneForAlmostCompleteGrid() {
        int[] grid = new int[SudokuSolver.CELLS];
        SudokuSolver.solve(grid, new Random(2));
        grid[10] = 0;

        assertThat(SudokuSolver.countSolutions(grid, 2)).isEqualTo(1);
    }

    @Test
    void countSolutionsIsZeroForContradictoryGrid() {
        int[] grid = new int[SudokuSolver.CELLS];
        // la case 0 n'a plus aucun candidat : 1..8 dans sa ligne, 9 dans sa colonne
        for (int i = 1; i <= 8; i++) grid[i] = i;
        grid[9] = 9;

        assertThat(SudokuSolver.countSolutions(grid, 2)).isZero();
    }
}
