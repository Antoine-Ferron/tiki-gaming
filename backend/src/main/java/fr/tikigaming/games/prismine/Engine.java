package fr.tikigaming.games.prismine;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Moteur de Prismine : géométrie de la galerie et trajet des faisceaux. Mêmes règles et même codage des cartes que
 * frontend/src/games/prismine/engine.ts, qui s'en sert pour tracer la carte du joueur.
 *
 * <p>Une carte est une chaîne de taille × taille caractères lus ligne par ligne : {@code .} vide, {@code #}
 * obsidienne, {@code a} à {@code l} un prisme (4 coins du rouge, puis du vert, puis du bleu).
 */
public final class Engine {

    /** Couleurs des prismes. La lumière d'un faisceau les mélange (OU binaire) ; 0 = blanc. */
    public static final int RED = 1;

    public static final int GREEN = 2;
    public static final int BLUE = 4;

    /** Coin de l'angle droit d'un prisme triangulaire, dans le sens horaire : ◢ ◣ ◤ ◥. */
    public static final int SE = 0;

    public static final int SW = 1;
    public static final int NW = 2;
    public static final int NE = 3;

    private static final String PRISM_CHARS = "abcdefghijkl";
    private static final List<Integer> PRISM_COLORS = List.of(RED, GREEN, BLUE);
    private static final Pattern GRID = Pattern.compile("^[.#a-l]*$");

    // Directions : 0 = nord, 1 = est, 2 = sud, 3 = ouest.
    private static final int[] DR = {-1, 0, 1, 0};
    private static final int[] DC = {0, 1, 0, -1};

    public record Prism(int color, int corner) {}

    /** Résultat d'un tir : entrée de sortie (null si absorbé), nombre de rebonds et couleur finale. */
    public record Outcome(Integer exit, int bounces, int color) {}

    /** Position d'une entrée (hors galerie) et direction du faisceau qui y entre. */
    public record Start(int row, int col, int dir) {}

    private Engine() {}

    public static char prism(int color, int corner) {
        int index = PRISM_COLORS.indexOf(color);
        if (index < 0 || corner < SE || corner > NE) throw new IllegalArgumentException("Prisme inconnu");
        return PRISM_CHARS.charAt(index * 4 + corner);
    }

    /** Couleur et coin d'un prisme, ou null pour le vide et l'obsidienne. */
    public static Prism prismOf(char piece) {
        int index = PRISM_CHARS.indexOf(piece);
        return index < 0 ? null : new Prism(PRISM_COLORS.get(index / 4), index % 4);
    }

    public static String emptyGrid(int size) {
        return ".".repeat(size * size);
    }

    public static String withPiece(String grid, int cell, char piece) {
        return grid.substring(0, cell) + piece + grid.substring(cell + 1);
    }

    public static boolean isValidGrid(String grid, int size) {
        return grid != null
                && grid.length() == size * size
                && GRID.matcher(grid).matches();
    }

    /**
     * Les 4 × taille entrées sont numérotées dans le sens horaire : haut (de gauche à droite), droite (de haut en
     * bas), bas (de droite à gauche), gauche (de bas en haut).
     */
    public static int entryCount(int size) {
        return 4 * size;
    }

    public static Start entryStart(int entry, int size) {
        int i = entry % size;
        return switch (entry / size) {
            case 0 -> new Start(-1, i, 2);
            case 1 -> new Start(i, size, 3);
            case 2 -> new Start(size, size - 1 - i, 0);
            default -> new Start(size - 1 - i, -1, 1);
        };
    }

    /** Entrée située à une position du bord (row ou col vaut -1 ou {@code size}). */
    public static int entryAt(int row, int col, int size) {
        if (row < 0) return col;
        if (col >= size) return size + row;
        if (row >= size) return 2 * size + (size - 1 - col);
        return 3 * size + (size - 1 - row);
    }

    public static Outcome trace(String grid, int size, int entry) {
        return walk(grid, size, entry, new ArrayList<>());
    }

    /** Points du trajet : départ (hors galerie), cases où il tourne, puis sortie ou obsidienne. */
    public static List<int[]> path(String grid, int size, int entry) {
        List<int[]> path = new ArrayList<>();
        walk(grid, size, entry, path);
        return path;
    }

    /** Entrées dont le tir ne donne pas le même résultat sur les deux cartes (vide = cartes équivalentes). */
    public static List<Integer> differingEntries(String a, String b, int size) {
        List<Integer> entries = new ArrayList<>();
        for (int entry = 0; entry < entryCount(size); entry++) {
            if (!trace(a, size, entry).equals(trace(b, size, entry))) entries.add(entry);
        }
        return entries;
    }

    private static Outcome walk(String grid, int size, int entry, List<int[]> path) {
        Start start = entryStart(entry, size);
        int row = start.row();
        int col = start.col();
        int dir = start.dir();
        int bounces = 0;
        int color = 0;
        path.add(new int[] {row, col});
        // Un prisme envoie les 4 directions d'arrivée vers 4 directions de départ distinctes : un trajet est
        // réversible, il ne peut pas boucler. La borne (case × direction) n'est qu'un garde-fou.
        for (int step = 0; step <= 4 * size * size; step++) {
            row += DR[dir];
            col += DC[dir];
            if (row < 0 || col < 0 || row >= size || col >= size) {
                path.add(new int[] {row, col});
                return new Outcome(entryAt(row, col, size), bounces, color);
            }
            char piece = grid.charAt(row * size + col);
            if (piece == '#') {
                path.add(new int[] {row, col});
                return new Outcome(null, bounces, color);
            }
            Prism prism = prismOf(piece);
            if (prism != null) {
                dir = deflect(prism.corner(), dir);
                color |= prism.color();
                bounces++;
                path.add(new int[] {row, col});
            }
        }
        return new Outcome(null, bounces, color);
    }

    /**
     * Les côtés plats (ceux de l'angle droit) renvoient le faisceau d'où il vient ; l'hypoténuse le dévie d'un quart
     * de tour, comme un miroir « / » pour ◢ et ◤ ou « \ » pour ◣ et ◥.
     */
    private static int deflect(int corner, int dir) {
        int side = (dir + 2) % 4; // côté de la case par lequel le faisceau entre
        if (side == (corner + 1) % 4 || side == (corner + 2) % 4) return side;
        return corner % 2 == 0 ? dir ^ 1 : 3 - dir;
    }
}
