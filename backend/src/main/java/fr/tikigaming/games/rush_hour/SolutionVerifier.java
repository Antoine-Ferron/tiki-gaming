package fr.tikigaming.games.rush_hour;

import java.util.ArrayList;
import java.util.List;

/**
 * Rejoue côté serveur les coups envoyés par le front, pour n'accepter que les parties réellement gagnées.
 */
public final class SolutionVerifier {

    private static final int SIZE = 6;
    private static final char RED_CAR = 'X';
    private static final int EXIT_ROW = 2;

    private SolutionVerifier() {}

    /** Vrai si chaque coup est légal et si la voiture rouge touche la sortie à la fin. */
    public static boolean isValidSolution(List<String> map, List<Move> moves) {
        List<Board.Vehicle> vehicles = new ArrayList<>(Board.parse(map).vehicles());
        for (Move move : moves) {
            int index = indexOf(vehicles, move.vehicleId());
            if (index < 0 || !canMove(vehicles, index, move.delta())) {
                return false;
            }
            vehicles.set(index, shifted(vehicles.get(index), move.delta()));
        }
        return vehicles.stream()
                .anyMatch(v -> v.id() == RED_CAR && v.row() == EXIT_ROW && v.col() + v.length() == SIZE);
    }

    /**
     * Rejoue une partie et renvoie son nombre de coups, comptés comme le front : les glissements successifs d'un même
     * véhicule forment un seul coup (R6), un aller-retour n'en compte aucun. Refuse un coup illégal ou une partie où
     * la voiture rouge n'est pas sortie.
     */
    public static int replay(List<String> map, List<Move> moves) {
        List<Board.Vehicle> vehicles = new ArrayList<>(Board.parse(map).vehicles());
        List<Move> counted = new ArrayList<>();
        for (Move move : moves) {
            int index = indexOf(vehicles, move.vehicleId());
            if (index < 0) {
                throw new IllegalArgumentException("Véhicule inconnu : " + move.vehicleId());
            }
            if (move.delta() == 0) {
                throw new IllegalArgumentException("Déplacement nul");
            }
            if (!canMove(vehicles, index, move.delta())) {
                throw new IllegalArgumentException(
                        "Déplacement impossible : " + move.vehicleId() + " de " + move.delta());
            }
            vehicles.set(index, shifted(vehicles.get(index), move.delta()));
            count(counted, move);
        }
        if (!isSolved(vehicles)) {
            throw new IllegalArgumentException("La voiture rouge n’est pas sortie");
        }
        return counted.size();
    }

    /** Ajoute le coup, ou prolonge le précédent s'il déplace le même véhicule (et l'annule s'il revient au départ). */
    private static void count(List<Move> counted, Move move) {
        Move last = counted.isEmpty() ? null : counted.get(counted.size() - 1);
        if (last == null || last.vehicleId() != move.vehicleId()) {
            counted.add(move);
            return;
        }
        int total = last.delta() + move.delta();
        counted.remove(counted.size() - 1);
        if (total != 0) {
            counted.add(new Move(move.vehicleId(), total));
        }
    }

    private static boolean isSolved(List<Board.Vehicle> vehicles) {
        return vehicles.stream()
                .anyMatch(v -> v.id() == RED_CAR && v.row() == EXIT_ROW && v.col() + v.length() == SIZE);
    }

    private static int indexOf(List<Board.Vehicle> vehicles, char id) {
        for (int i = 0; i < vehicles.size(); i++) {
            if (vehicles.get(i).id() == id) {
                return i;
            }
        }
        return -1;
    }

    /** Le véhicule peut glisser de {@code delta} cases sans sortir du plateau ni traverser un autre véhicule. */
    private static boolean canMove(List<Board.Vehicle> vehicles, int index, int delta) {
        if (delta == 0) {
            return false;
        }
        boolean[][] occupied = new boolean[SIZE][SIZE];
        for (int i = 0; i < vehicles.size(); i++) {
            if (i != index) {
                for (int[] cell : cells(vehicles.get(i))) {
                    occupied[cell[0]][cell[1]] = true;
                }
            }
        }
        Board.Vehicle vehicle = vehicles.get(index);
        int step = Integer.signum(delta);
        for (int offset = step; offset != delta + step; offset += step) {
            for (int[] cell : cells(shifted(vehicle, offset))) {
                boolean inside = cell[0] >= 0 && cell[0] < SIZE && cell[1] >= 0 && cell[1] < SIZE;
                if (!inside || occupied[cell[0]][cell[1]]) {
                    return false;
                }
            }
        }
        return true;
    }

    private static Board.Vehicle shifted(Board.Vehicle v, int delta) {
        return v.orientation() == Board.Orientation.HORIZONTAL
                ? new Board.Vehicle(v.id(), v.orientation(), v.row(), v.col() + delta, v.length())
                : new Board.Vehicle(v.id(), v.orientation(), v.row() + delta, v.col(), v.length());
    }

    private static List<int[]> cells(Board.Vehicle v) {
        List<int[]> cells = new ArrayList<>();
        for (int k = 0; k < v.length(); k++) {
            boolean horizontal = v.orientation() == Board.Orientation.HORIZONTAL;
            cells.add(new int[] {horizontal ? v.row() : v.row() + k, horizontal ? v.col() + k : v.col()});
        }
        return cells;
    }
}
