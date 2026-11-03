package fr.tikigaming.games.mini_gta.world;

import java.util.Arrays;
import java.util.Objects;

/** Conteneur du port ; {@code color} est une couleur RVB. */
public record Container(double x, double y, double z, double rot, double[] color, int chunk) {
    @Override
    public boolean equals(Object o) {
        return o instanceof Container c
                && Double.compare(x, c.x) == 0
                && Double.compare(y, c.y) == 0
                && Double.compare(z, c.z) == 0
                && Double.compare(rot, c.rot) == 0
                && Arrays.equals(color, c.color)
                && chunk == c.chunk;
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y, z, rot, chunk) * 31 + Arrays.hashCode(color);
    }

    @Override
    public String toString() {
        return "Container[x=" + x + ", y=" + y + ", z=" + z + ", rot=" + rot + ", color=" + Arrays.toString(color)
                + ", chunk=" + chunk + "]";
    }
}
