package fr.tikigaming.games.sudoku;

import java.util.List;
import org.springframework.stereotype.Service;

/** Vérification d'une partie et calcul du score (plus haut = meilleur). */
@Service
public class SudokuService {

    /** `complete` : toutes les cases remplies ; `solved` : complète et sans conflit. */
    public record CheckResult(
            boolean complete, boolean solved, List<Integer> conflicts, int score, ScoreBreakdown breakdown) {}

    /**
     * @param puzzle grille de départ (0 = vide)
     * @param values grille du joueur (0 = vide)
     * @throws IllegalArgumentException si les grilles sont mal formées ou si `values` modifie un indice de départ
     */
    public CheckResult check(int[] puzzle, int[] values, Difficulty difficulty, int seconds, int mistakes) {
        validateShape(puzzle, "puzzle");
        validateShape(values, "values");
        if (seconds < 0 || mistakes < 0) throw new IllegalArgumentException("Temps et erreurs doivent être positifs");
        for (int i = 0; i < puzzle.length; i++) {
            if (puzzle[i] != 0 && values[i] != puzzle[i]) {
                throw new IllegalArgumentException("Un indice de départ a été modifié (case " + i + ")");
            }
        }

        List<Integer> conflicts = SudokuSolver.findConflicts(values);
        boolean complete = true;
        for (int v : values) {
            if (v == 0) {
                complete = false;
                break;
            }
        }
        boolean solved = complete && conflicts.isEmpty();
        ScoreBreakdown breakdown =
                solved ? ScoreCalculator.compute(difficulty, seconds, mistakes) : ScoreBreakdown.NONE;
        return new CheckResult(complete, solved, conflicts, breakdown.total(), breakdown);
    }

    private static void validateShape(int[] grid, String name) {
        if (grid == null || grid.length != SudokuSolver.CELLS) {
            throw new IllegalArgumentException(name + " doit contenir " + SudokuSolver.CELLS + " cases");
        }
        for (int v : grid) {
            if (v < 0 || v > SudokuSolver.SIZE) {
                throw new IllegalArgumentException(name + " : chiffres de 0 à 9 uniquement");
            }
        }
    }
}
