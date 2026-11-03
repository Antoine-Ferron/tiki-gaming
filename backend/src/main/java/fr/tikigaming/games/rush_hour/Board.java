package fr.tikigaming.games.rush_hour;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Plateau de Rush Hour : la liste des véhicules lue depuis une map de 6 lignes de 6 cases. */
public record Board(List<Vehicle> vehicles) {

    public enum Orientation {
        HORIZONTAL,
        VERTICAL
    }

    public record Vehicle(char id, Orientation orientation, int row, int col, int length) {}

    private record Cell(int row, int col) {}

    /** Lit une map : '.' = case vide, chaque lettre = les cases d'un véhicule. */
    public static Board parse(List<String> map) {
        Map<Character, List<Cell>> cellsById = new LinkedHashMap<>();
        for (int row = 0; row < map.size(); row++) {
            String line = map.get(row);
            for (int col = 0; col < line.length(); col++) {
                char id = line.charAt(col);
                if (id != '.') {
                    cellsById.computeIfAbsent(id, k -> new ArrayList<>()).add(new Cell(row, col));
                }
            }
        }

        List<Vehicle> vehicles = new ArrayList<>();
        cellsById.forEach((id, cells) -> {
            Cell first = cells.getFirst();
            boolean horizontal = cells.stream().allMatch(c -> c.row() == first.row());
            Orientation orientation = horizontal ? Orientation.HORIZONTAL : Orientation.VERTICAL;
            vehicles.add(new Vehicle(id, orientation, first.row(), first.col(), cells.size()));
        });
        return new Board(List.copyOf(vehicles));
    }
}
