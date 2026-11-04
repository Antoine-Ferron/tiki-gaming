package fr.tikigaming.games.rush_hour;

import static fr.tikigaming.games.rush_hour.Board.SIZE;

import java.util.ArrayList;
import java.util.List;

/**
 * Rejoue côté serveur les coups envoyés par le front, pour n'accepter que les parties réellement gagnées.
 * Même représentation que le solveur : la position de chaque véhicule sur son axe.
 */
public final class SolutionVerifier {

    private SolutionVerifier() {}

    /**
     * Rejoue une partie et renvoie son nombre de coups, comptés comme le front : les glissements successifs d'un même
     * véhicule forment un seul coup (R6), un aller-retour n'en compte aucun. Refuse un coup illégal ou une partie où
     * la voiture rouge n'est pas sortie.
     */
    public static int replay(List<String> map, List<Move> moves) {
        List<Board.Vehicle> vehicles = Board.parse(map).vehicles();
        int[] state = vehicles.stream().mapToInt(Solver::axisPosition).toArray();
        List<Move> counted = new ArrayList<>();
        for (Move move : moves) {
            int index = indexOf(vehicles, move.vehicleId());
            if (index < 0) {
                throw new IllegalArgumentException("Véhicule inconnu : " + move.vehicleId());
            }
            if (move.delta() == 0) {
                throw new IllegalArgumentException("Déplacement nul");
            }
            if (!canMove(vehicles, state, index, move.delta())) {
                throw new IllegalArgumentException(
                        "Déplacement impossible : " + move.vehicleId() + " de " + move.delta());
            }
            state[index] += move.delta();
            count(counted, move);
        }
        int red = Solver.indexOfRedCar(vehicles);
        if (state[red] != SIZE - vehicles.get(red).length()) {
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

    private static int indexOf(List<Board.Vehicle> vehicles, char id) {
        for (int i = 0; i < vehicles.size(); i++) {
            if (vehicles.get(i).id() == id) {
                return i;
            }
        }
        return -1;
    }

    /** Le véhicule peut glisser de `delta` cases sans sortir du plateau ni traverser un autre véhicule. */
    private static boolean canMove(List<Board.Vehicle> vehicles, int[] state, int index, int delta) {
        Board.Vehicle vehicle = vehicles.get(index);
        int target = state[index] + delta;
        if (target < 0 || target + vehicle.length() > SIZE) {
            return false;
        }
        boolean[] occupied = Solver.occupancy(vehicles, state);
        // Cases à traverser : devant le véhicule, dans le sens du glissement, jusqu'à sa position d'arrivée.
        int from = delta > 0 ? state[index] + vehicle.length() : target;
        int to = delta > 0 ? target + vehicle.length() - 1 : state[index] - 1;
        for (int p = from; p <= to; p++) {
            if (occupied[Solver.cell(vehicle, p)]) {
                return false;
            }
        }
        return true;
    }
}
