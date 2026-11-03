package fr.tikigaming.games.mini_gta.core;

/** Fonctions numériques pures partagées par tous les systèmes. */
public final class MathUtil {
    private MathUtil() {}

    public static double clamp(double v, double min, double max) {
        return v < min ? min : v > max ? max : v;
    }

    public static double lerp(double a, double b, double t) {
        return a + (b - a) * t;
    }

    public static double invLerp(double a, double b, double v) {
        return clamp((v - a) / (b - a), 0, 1);
    }

    public static double smoothstep(double a, double b, double v) {
        double t = invLerp(a, b, v);
        return t * t * (3 - 2 * t);
    }

    /** Lissage exponentiel indépendant de la fréquence d'image. */
    public static double damp(double a, double b, double lambda, double dt) {
        return lerp(a, b, 1 - Math.exp(-lambda * dt));
    }

    /** Ramène un angle dans [-π, π). Le modulo Java garde le signe du dividende, d'où la correction. */
    public static double wrapAngle(double a) {
        a = (a + Math.PI) % (Math.PI * 2);
        if (a < 0) a += Math.PI * 2;
        return a - Math.PI;
    }

    public static double dampAngle(double a, double b, double lambda, double dt) {
        return a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
    }

    public static double dist2(double ax, double az, double bx, double bz) {
        return Math.hypot(ax - bx, az - bz);
    }

    /** Distance d'un point à un segment dans le plan XZ, et paramètre de projection t ∈ [0, 1]. */
    public record SegmentHit(double d, double t) {}

    public static SegmentHit pointSegment(double px, double pz, double ax, double az, double bx, double bz) {
        double dx = bx - ax;
        double dz = bz - az;
        double len2 = dx * dx + dz * dz;
        double t = len2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1) : 0;
        return new SegmentHit(Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t);
    }
}
