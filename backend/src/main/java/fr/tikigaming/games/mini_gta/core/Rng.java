package fr.tikigaming.games.mini_gta.core;

import java.util.List;

/**
 * PRNG seedé (mulberry32), déterministe sur toutes les plateformes. L'état tient sur 32 bits :
 * l'algorithme repose sur le débordement des {@code int} et sur des conversions non signées.
 */
public final class Rng {
    private static final double TWO_POW_32 = 4294967296.0;

    private int state;

    public Rng(long seed) {
        this.state = (int) seed;
    }

    /** Flottant dans [0, 1). */
    public double next() {
        int t = state += 0x6d2b79f5;
        t = (t ^ (t >>> 15)) * (t | 1);
        t ^= t + (t ^ (t >>> 7)) * (t | 61);
        return Integer.toUnsignedLong(t ^ (t >>> 14)) / TWO_POW_32;
    }

    public double range(double min, double max) {
        return min + (max - min) * next();
    }

    /** Entier dans [min, max] inclus. */
    public int nextInt(int min, int max) {
        return (int) Math.floor(range(min, max + 1));
    }

    public <T> T pick(List<T> items) {
        if (items.isEmpty()) throw new IllegalArgumentException("pick sur une liste vide");
        return items.get((int) Math.floor(next() * items.size()));
    }

    public boolean chance(double p) {
        return next() < p;
    }

    /** Sous-flux indépendant : ajouter des tirages dans un générateur ne décale pas les autres. */
    public Rng fork(String label) {
        long draw = (long) Math.floor(next() * TWO_POW_32);
        return new Rng(hashString(label) ^ draw);
    }

    /** FNV-1a 32 bits, renvoyé comme entier non signé. */
    public static long hashString(String s) {
        int h = 0x811c9dc5;
        for (int i = 0; i < s.length(); i++) {
            h ^= s.charAt(i);
            h *= 0x01000193;
        }
        return Integer.toUnsignedLong(h);
    }
}
