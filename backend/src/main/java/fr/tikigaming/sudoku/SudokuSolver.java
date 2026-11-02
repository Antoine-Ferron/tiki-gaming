package fr.tikigaming.sudoku;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/** Règles du sudoku : validation de placement, résolution et comptage de solutions par backtracking. */
public final class SudokuSolver {

    public static final int SIZE = 9;
    public static final int CELLS = SIZE * SIZE;

    private SudokuSolver() {}

    /** Vrai si `n` ne se répète pas dans la ligne, la colonne ou le bloc de la case `idx` (la case elle-même est ignorée). */
    public static boolean isValidPlacement(int[] grid, int idx, int n) {
        int r = idx / SIZE;
        int c = idx % SIZE;
        for (int i = 0; i < SIZE; i++) {
            if (i != c && grid[r * SIZE + i] == n) return false;
            if (i != r && grid[i * SIZE + c] == n) return false;
        }
        int br = r - r % 3;
        int bc = c - c % 3;
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                int k = (br + i) * SIZE + bc + j;
                if (k != idx && grid[k] == n) return false;
            }
        }
        return true;
    }

    /** Remplit la grille (modifiée sur place). `random` mélange l'ordre des essais, null = ordre croissant. */
    public static boolean solve(int[] grid, Random random) {
        int idx = firstEmpty(grid);
        if (idx == -1) return true;
        for (int n : digits(random)) {
            if (isValidPlacement(grid, idx, n)) {
                grid[idx] = n;
                if (solve(grid, random)) return true;
                grid[idx] = 0;
            }
        }
        return false;
    }

    /** Nombre de solutions, arrêté dès `limit` ; la grille n'est pas modifiée. */
    public static int countSolutions(int[] grid, int limit) {
        return count(grid.clone(), limit);
    }

    private static int count(int[] grid, int limit) {
        int idx = firstEmpty(grid);
        if (idx == -1) return 1;
        int found = 0;
        for (int n = 1; n <= SIZE && found < limit; n++) {
            if (isValidPlacement(grid, idx, n)) {
                grid[idx] = n;
                found += count(grid, limit - found);
                grid[idx] = 0;
            }
        }
        return found;
    }

    /** Indices des cases non vides en conflit avec une autre case. */
    public static List<Integer> findConflicts(int[] grid) {
        List<Integer> bad = new ArrayList<>();
        for (int i = 0; i < grid.length; i++) {
            if (grid[i] != 0 && !isValidPlacement(grid, i, grid[i])) bad.add(i);
        }
        return bad;
    }

    private static int firstEmpty(int[] grid) {
        for (int i = 0; i < grid.length; i++) {
            if (grid[i] == 0) return i;
        }
        return -1;
    }

    private static List<Integer> digits(Random random) {
        List<Integer> digits = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6, 7, 8, 9));
        if (random != null) Collections.shuffle(digits, random);
        return digits;
    }
}
