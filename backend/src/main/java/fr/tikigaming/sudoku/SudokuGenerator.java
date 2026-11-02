package fr.tikigaming.sudoku;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import org.springframework.stereotype.Component;

/** Génère des grilles à solution unique. */
@Component
public class SudokuGenerator {

    public record Puzzle(int[] puzzle, int[] solution) {}

    private final Random random;

    public SudokuGenerator() {
        this(new Random());
    }

    /** Constructeur pour les tests : un `Random` à graine fixe rend la génération reproductible. */
    SudokuGenerator(Random random) {
        this.random = random;
    }

    public Puzzle generate(Difficulty difficulty) {
        int[] solution = new int[SudokuSolver.CELLS];
        SudokuSolver.solve(solution, random);

        int[] puzzle = solution.clone();
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < SudokuSolver.CELLS; i++) order.add(i);
        Collections.shuffle(order, random);

        int clues = SudokuSolver.CELLS;
        for (int idx : order) {
            if (clues <= difficulty.clues()) break;
            int saved = puzzle[idx];
            puzzle[idx] = 0;
            if (SudokuSolver.countSolutions(puzzle, 2) == 1) clues--;
            else puzzle[idx] = saved;
        }
        return new Puzzle(puzzle, solution);
    }
}
