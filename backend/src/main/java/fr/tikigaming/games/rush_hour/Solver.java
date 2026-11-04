package fr.tikigaming.games.rush_hour;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.OptionalInt;
import java.util.Set;

/**
 * Minimum de coups pour sortir la voiture rouge (parcours en largeur : tous les plateaux à 1 coup, puis à 2…).
 * Un coup = un glissement d'un véhicule, quelle que soit la distance. Même algorithme que le front.
 */
public final class Solver {

    static final int SIZE = 6;
    static final char RED_CAR = 'X';

    private Solver() {}

    /** Nombre minimal de coups, ou vide si le plateau est impossible. */
    public static OptionalInt minimumMoves(Board board) {
        List<Board.Vehicle> vehicles = board.vehicles();
        int red = indexOfRedCar(vehicles);
        int goal = SIZE - vehicles.get(red).length();
        int[] start = vehicles.stream().mapToInt(Solver::axisPosition).toArray();
        if (start[red] == goal) {
            return OptionalInt.of(0);
        }

        Set<String> seen = new HashSet<>(List.of(Arrays.toString(start)));
        List<int[]> frontier = List.of(start);
        for (int depth = 1; !frontier.isEmpty(); depth++) {
            List<int[]> next = new ArrayList<>();
            for (int[] state : frontier) {
                for (int[] moved : neighbours(vehicles, state)) {
                    if (moved[red] == goal) {
                        return OptionalInt.of(depth);
                    }
                    if (seen.add(Arrays.toString(moved))) {
                        next.add(moved);
                    }
                }
            }
            frontier = next;
        }
        return OptionalInt.empty();
    }

    /** Position d'un véhicule sur son axe : sa colonne s'il est horizontal, sa ligne s'il est vertical. */
    static int axisPosition(Board.Vehicle v) {
        return v.orientation() == Board.Orientation.HORIZONTAL ? v.col() : v.row();
    }

    /** Tous les états atteignables en un glissement (chaque véhicule, chaque sens, chaque distance). */
    static List<int[]> neighbours(List<Board.Vehicle> vehicles, int[] state) {
        boolean[] occupied = occupancy(vehicles, state);
        List<int[]> result = new ArrayList<>();
        for (int i = 0; i < vehicles.size(); i++) {
            Board.Vehicle v = vehicles.get(i);
            for (int p = state[i] - 1; p >= 0 && !occupied[cell(v, p)]; p--) {
                result.add(with(state, i, p));
            }
            for (int p = state[i] + 1; p + v.length() <= SIZE && !occupied[cell(v, p + v.length() - 1)]; p++) {
                result.add(with(state, i, p));
            }
        }
        return result;
    }

    private static int indexOfRedCar(List<Board.Vehicle> vehicles) {
        for (int i = 0; i < vehicles.size(); i++) {
            if (vehicles.get(i).id() == RED_CAR) {
                return i;
            }
        }
        throw new IllegalArgumentException("Le plateau n'a pas de voiture rouge");
    }

    private static boolean[] occupancy(List<Board.Vehicle> vehicles, int[] state) {
        boolean[] grid = new boolean[SIZE * SIZE];
        for (int i = 0; i < vehicles.size(); i++) {
            for (int k = 0; k < vehicles.get(i).length(); k++) {
                grid[cell(vehicles.get(i), state[i] + k)] = true;
            }
        }
        return grid;
    }

    /** Index de la case située à la position `p` de l'axe du véhicule. */
    private static int cell(Board.Vehicle v, int p) {
        return v.orientation() == Board.Orientation.HORIZONTAL ? v.row() * SIZE + p : p * SIZE + v.col();
    }

    private static int[] with(int[] state, int index, int position) {
        int[] copy = state.clone();
        copy[index] = position;
        return copy;
    }
}
