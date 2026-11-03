package fr.tikigaming.games.prismine;

import static fr.tikigaming.games.prismine.Engine.BLUE;
import static fr.tikigaming.games.prismine.Engine.GREEN;
import static fr.tikigaming.games.prismine.Engine.RED;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.IntPredicate;
import java.util.stream.IntStream;

/** Génération des étages : un étage est entièrement défini par sa profondeur et sa graine. */
public final class Floors {

    /** Taille, pièces cachées et couleurs possibles des prismes d'un étage. */
    public record Spec(int size, int prisms, int obsidians, List<Integer> colors) {}

    public record Floor(int depth, long seed, Spec spec, String grid) {}

    private static final List<Integer> RG = List.of(RED, GREEN);
    private static final List<Integer> RGB = List.of(RED, GREEN, BLUE);

    /** Au-delà du dernier palier, la difficulté plafonne. */
    private static final List<Spec> SPECS = List.of(
            new Spec(6, 3, 0, List.of(RED)),
            new Spec(6, 4, 0, RG),
            new Spec(7, 4, 1, RG),
            new Spec(7, 5, 1, RGB),
            new Spec(8, 6, 1, RGB),
            new Spec(8, 7, 1, RGB),
            new Spec(8, 7, 2, RGB),
            new Spec(8, 8, 2, RGB));

    private static final int MAX_ATTEMPTS = 100;

    private Floors() {}

    public static Spec spec(int depth) {
        return SPECS.get(Math.min(Math.max(depth, 1), SPECS.size()) - 1);
    }

    public static Floor generate(int depth, long seed) {
        Spec spec = spec(depth);
        Mulberry32 random = new Mulberry32(seed);
        String grid = randomGrid(spec, random);
        // Une pièce qu'aucun faisceau ne peut atteindre serait impossible à deviner : on recommence le tirage.
        for (int attempt = 1; attempt < MAX_ATTEMPTS && !allPiecesReachable(grid, spec.size()); attempt++) {
            grid = randomGrid(spec, random);
        }
        if (!allPiecesReachable(grid, spec.size())) {
            // Tirages épuisés (très rare) : on retire les pièces hors de portée plutôt que de les laisser cachées.
            // Aucun faisceau ne les touchait, donc les trajets ne changent pas ; le décompte annoncé suit la grille.
            grid = withoutUnreachablePieces(grid, spec.size());
            spec = new Spec(
                    spec.size(), count(grid, c -> c != '.' && c != '#'), count(grid, c -> c == '#'), spec.colors());
        }
        return new Floor(depth, seed, spec, grid);
    }

    private static int count(String grid, IntPredicate piece) {
        return (int) grid.chars().filter(piece).count();
    }

    private static String withoutUnreachablePieces(String grid, int size) {
        Set<Integer> touched = touchedCells(grid, size);
        char[] cells = grid.toCharArray();
        for (int cell = 0; cell < cells.length; cell++) {
            if (!touched.contains(cell)) cells[cell] = '.';
        }
        return new String(cells);
    }

    private static String randomGrid(Spec spec, Mulberry32 random) {
        int size = spec.size();
        char[] cells = new char[size * size];
        Arrays.fill(cells, '.');
        List<Integer> free =
                new ArrayList<>(IntStream.range(0, size * size).boxed().toList());
        for (int n = 0; n < spec.prisms(); n++) {
            int color = spec.colors().get(random.pick(spec.colors().size()));
            int corner = random.pick(4);
            cells[free.remove(random.pick(free.size()))] = Engine.prism(color, corner);
        }
        for (int n = 0; n < spec.obsidians(); n++) cells[free.remove(random.pick(free.size()))] = '#';
        return new String(cells);
    }

    private static boolean allPiecesReachable(String grid, int size) {
        Set<Integer> touched = touchedCells(grid, size);
        for (int cell = 0; cell < grid.length(); cell++) {
            if (grid.charAt(cell) != '.' && !touched.contains(cell)) return false;
        }
        return true;
    }

    /** Cases touchées par au moins un faisceau, depuis l'une des entrées. */
    private static Set<Integer> touchedCells(String grid, int size) {
        Set<Integer> touched = new HashSet<>();
        for (int entry = 0; entry < Engine.entryCount(size); entry++) {
            for (int[] cell : Engine.path(grid, size, entry)) {
                if (cell[0] >= 0 && cell[1] >= 0 && cell[0] < size && cell[1] < size) {
                    touched.add(cell[0] * size + cell[1]);
                }
            }
        }
        return touched;
    }

    /** Générateur pseudo-aléatoire déterministe, identique à mulberry32 du front : même graine, même suite. */
    static final class Mulberry32 {
        private int state;

        Mulberry32(long seed) {
            this.state = (int) seed;
        }

        double next() {
            state += 0x6D2B79F5;
            int t = state;
            t = (t ^ (t >>> 15)) * (t | 1);
            t ^= t + (t ^ (t >>> 7)) * (t | 61);
            return Integer.toUnsignedLong(t ^ (t >>> 14)) / 4294967296.0;
        }

        int pick(int count) {
            return (int) Math.floor(next() * count);
        }
    }
}
