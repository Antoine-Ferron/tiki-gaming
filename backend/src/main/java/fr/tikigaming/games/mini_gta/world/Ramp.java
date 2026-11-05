package fr.tikigaming.games.mini_gta.world;

/**
 * Tremplin : un coin posé au sol, qui monte de 0 à {@code height} sur {@code length} dans la direction de
 * {@code rot} (cap : avant = (sin rot, 0, cos rot)).
 *
 * @param x centre de l'emprise au sol
 * @param y hauteur du sol sous le tremplin
 * @param z centre de l'emprise au sol
 */
public record Ramp(
        double x,
        double y,
        double z,
        double rot,
        double length,
        double width,
        double height,
        RampKind kind,
        int chunk) {}
