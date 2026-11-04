package fr.tikigaming.games.mini_gta.world;

/** Port de bruit 2D : injecté dans {@link Terrain} pour isoler le relief de l'aléa. */
@FunctionalInterface
public interface Noise2D {
    /** Valeur dans [-1, 1]. */
    double noise(double x, double y);
}
