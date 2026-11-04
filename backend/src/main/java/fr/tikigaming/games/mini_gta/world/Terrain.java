package fr.tikigaming.games.mini_gta.world;

import static fr.tikigaming.games.mini_gta.core.MathUtil.clamp;
import static fr.tikigaming.games.mini_gta.core.MathUtil.lerp;
import static fr.tikigaming.games.mini_gta.core.MathUtil.smoothstep;
import static fr.tikigaming.games.mini_gta.world.WorldConstants.MAP_HALF;
import static fr.tikigaming.games.mini_gta.world.WorldConstants.TERRAIN_CELLS;
import static fr.tikigaming.games.mini_gta.world.WorldConstants.TERRAIN_RES;

import fr.tikigaming.games.mini_gta.core.MathUtil;
import fr.tikigaming.games.mini_gta.core.Rng;
import fr.tikigaming.games.mini_gta.world.WorldConstants.Ring;
import java.util.List;

/**
 * Grille de hauteurs précalculée de (TERRAIN_CELLS + 1)² échantillons, index = ix * (N + 1) + iz :
 * exactement le format du heightfield Rapier (lignes le long de Z, colonnes le long de X).
 */
public final class Terrain {
    private final int n = TERRAIN_CELLS;
    private final float[] heights;
    private final Noise2D noise;

    public Terrain(Rng rng) {
        this(new SimplexNoise2D(rng.fork("terrain")::next));
    }

    public Terrain(Noise2D noise) {
        this.noise = noise;
        this.heights = new float[(n + 1) * (n + 1)];
        for (int ix = 0; ix <= n; ix++) {
            for (int iz = 0; iz <= n; iz++) {
                double x = -MAP_HALF + ix * TERRAIN_RES;
                double z = -MAP_HALF + iz * TERRAIN_RES;
                heights[ix * (n + 1) + iz] = (float) baseHeight(x, z);
            }
        }
    }

    /** Grille brute (partagée, pas copiée : c'est le tampon passé au moteur physique). */
    public float[] heights() {
        return heights;
    }

    public int cells() {
        return n;
    }

    private double fbm(double x, double z) {
        double a = 0.5;
        double f = 1;
        double sum = 0;
        for (int o = 0; o < 4; o++) {
            sum += a * noise.noise(x * f, z * f);
            a *= 0.5;
            f *= 2.03;
        }
        return sum * 0.5 + 0.5; // ~[0, 1]
    }

    public double baseHeight(double x, double z) {
        double land = 0;
        // Collines du nord, juste après le périphérique.
        double t = smoothstep(Ring.MIN_Z - 15, Ring.MIN_Z - 240, z);
        if (t > 0) land += t * (14 + (-z + Ring.MIN_Z) * 0.1 + 34 * fbm(x * 0.004, z * 0.004));
        // Collines de bordure (est et sud) qui ferment le monde.
        double b = Math.max(smoothstep(990, 1024, x), smoothstep(955, 1024, z));
        if (b > 0) land += b * 40 * (0.6 + 0.4 * fbm(x * 0.01, z * 0.01));
        // Côte : plage en pente douce, ou mur de quai net dans le port.
        double d = x - WorldConstants.shoreX(z);
        if (d < 0) {
            double sea = WorldConstants.isPortQuay(z) ? -9 : Math.max(-9, d * 0.07);
            return Math.min(land, sea);
        }
        return land;
    }

    /** Aplanit le terrain le long d'une route (routes de colline). Renvoie le profil lissé. */
    public double[] flattenAlong(Polyline line) {
        List<Polyline.Point> pts = line.points();
        double[] prof = new double[pts.size()];
        for (int i = 0; i < prof.length; i++) {
            prof[i] = heightAt(pts.get(i).x(), pts.get(i).z());
        }
        // Profil : échantillonnage, lissage, pente bornée.
        for (int pass = 0; pass < 6; pass++) {
            double[] prev = prof.clone();
            for (int i = 1; i < prof.length - 1; i++) prof[i] = (prev[i - 1] + prev[i] * 2 + prev[i + 1]) / 4;
        }
        for (int i = 1; i < prof.length; i++) {
            double len = Math.hypot(
                    pts.get(i).x() - pts.get(i - 1).x(),
                    pts.get(i).z() - pts.get(i - 1).z());
            prof[i] = clamp(prof[i], prof[i - 1] - len * 0.14, prof[i - 1] + len * 0.14);
        }
        double inner = line.width() / 2 + 2;
        double outer = line.width() / 2 + 14;
        int stride = n + 1;
        for (int s = 0; s < pts.size() - 1; s++) {
            Polyline.Point a = pts.get(s);
            Polyline.Point b = pts.get(s + 1);
            int ix0 = (int) Math.max(0, Math.floor((Math.min(a.x(), b.x()) - outer + MAP_HALF) / TERRAIN_RES));
            int ix1 = (int) Math.min(n, Math.ceil((Math.max(a.x(), b.x()) + outer + MAP_HALF) / TERRAIN_RES));
            int iz0 = (int) Math.max(0, Math.floor((Math.min(a.z(), b.z()) - outer + MAP_HALF) / TERRAIN_RES));
            int iz1 = (int) Math.min(n, Math.ceil((Math.max(a.z(), b.z()) + outer + MAP_HALF) / TERRAIN_RES));
            for (int ix = ix0; ix <= ix1; ix++) {
                for (int iz = iz0; iz <= iz1; iz++) {
                    double x = -MAP_HALF + ix * TERRAIN_RES;
                    double z = -MAP_HALF + iz * TERRAIN_RES;
                    MathUtil.SegmentHit hit = MathUtil.pointSegment(x, z, a.x(), a.z(), b.x(), b.z());
                    if (hit.d() > outer) continue;
                    double target = lerp(prof[s], prof[s + 1], hit.t());
                    double k = smoothstep(inner, outer, hit.d());
                    int idx = ix * stride + iz;
                    double blended = lerp(target, heights[idx], k);
                    if (k < 1) heights[idx] = (float) (hit.d() <= inner ? target : blended);
                }
            }
        }
        return prof;
    }

    public double heightAt(double x, double z) {
        double fx = clamp((x + MAP_HALF) / TERRAIN_RES, 0, n - 1e-6);
        double fz = clamp((z + MAP_HALF) / TERRAIN_RES, 0, n - 1e-6);
        int ix = (int) Math.floor(fx);
        int iz = (int) Math.floor(fz);
        double tx = fx - ix;
        double tz = fz - iz;
        int stride = n + 1;
        double h00 = heights[ix * stride + iz];
        double h10 = heights[(ix + 1) * stride + iz];
        double h01 = heights[ix * stride + iz + 1];
        double h11 = heights[(ix + 1) * stride + iz + 1];
        return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
    }
}
