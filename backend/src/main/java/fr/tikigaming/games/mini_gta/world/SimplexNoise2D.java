package fr.tikigaming.games.mini_gta.world;

import java.util.function.DoubleSupplier;

/**
 * Bruit simplex 2D (algorithme de Stefan Gustavson, optimisations de Peter Eastman ; structure
 * inspirée de simplex-noise de Jonas Wagner, licence MIT). La table de permutation est tirée d'une
 * source d'aléa injectée : même source, même relief.
 */
public final class SimplexNoise2D implements Noise2D {
    private static final double SQRT3 = Math.sqrt(3.0);
    private static final double F2 = 0.5 * (SQRT3 - 1.0);
    private static final double G2 = (3.0 - SQRT3) / 6.0;
    private static final double[] GRAD2 = {
        1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1,
    };

    private final int[] perm;
    private final double[] permGrad2x;
    private final double[] permGrad2y;

    public SimplexNoise2D(DoubleSupplier random) {
        perm = buildPermutationTable(random);
        permGrad2x = new double[perm.length];
        permGrad2y = new double[perm.length];
        for (int i = 0; i < perm.length; i++) {
            permGrad2x[i] = GRAD2[(perm[i] % 12) * 2];
            permGrad2y[i] = GRAD2[(perm[i] % 12) * 2 + 1];
        }
    }

    static int[] buildPermutationTable(DoubleSupplier random) {
        int[] p = new int[512];
        for (int i = 0; i < 256; i++) p[i] = i;
        for (int i = 0; i < 255; i++) {
            int r = i + (int) (random.getAsDouble() * (256 - i));
            int aux = p[i];
            p[i] = p[r];
            p[r] = aux;
        }
        for (int i = 256; i < 512; i++) p[i] = p[i - 256];
        return p;
    }

    @Override
    public double noise(double x, double y) {
        double n0 = 0;
        double n1 = 0;
        double n2 = 0;
        // Déformation de l'espace pour trouver la cellule simplexe.
        double s = (x + y) * F2;
        int i = (int) Math.floor(x + s);
        int j = (int) Math.floor(y + s);
        double t = (i + j) * G2;
        double x0 = x - (i - t);
        double y0 = y - (j - t);
        int i1 = x0 > y0 ? 1 : 0;
        int j1 = x0 > y0 ? 0 : 1;
        double x1 = x0 - i1 + G2;
        double y1 = y0 - j1 + G2;
        double x2 = x0 - 1.0 + 2.0 * G2;
        double y2 = y0 - 1.0 + 2.0 * G2;
        int ii = i & 255;
        int jj = j & 255;
        double t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            int gi0 = ii + perm[jj];
            t0 *= t0;
            n0 = t0 * t0 * (permGrad2x[gi0] * x0 + permGrad2y[gi0] * y0);
        }
        double t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            int gi1 = ii + i1 + perm[jj + j1];
            t1 *= t1;
            n1 = t1 * t1 * (permGrad2x[gi1] * x1 + permGrad2y[gi1] * y1);
        }
        double t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            int gi2 = ii + 1 + perm[jj + 1];
            t2 *= t2;
            n2 = t2 * t2 * (permGrad2x[gi2] * x2 + permGrad2y[gi2] * y2);
        }
        return 70.0 * (n0 + n1 + n2);
    }
}
