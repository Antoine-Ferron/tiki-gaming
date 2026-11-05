package fr.tikigaming.games.mini_gta.world;

/**
 * Îlot urbain délimité par les routes.
 *
 * @param gi indice de grille en X, -1 pour les bandes extérieures
 * @param gj indice de grille en Z, -1 pour les bandes extérieures
 */
public record Block(
        int id, double x0, double x1, double z0, double z1, District district, boolean park, int gi, int gj) {
    public boolean containsStrict(double x, double z) {
        return x > x0 && x < x1 && z > z0 && z < z1;
    }

    public boolean containsInclusive(double x, double z) {
        return x >= x0 && x <= x1 && z >= z0 && z <= z1;
    }
}
