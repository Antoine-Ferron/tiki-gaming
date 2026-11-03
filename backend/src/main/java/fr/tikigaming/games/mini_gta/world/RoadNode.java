package fr.tikigaming.games.mini_gta.world;

import java.util.ArrayList;
import java.util.List;

/** Nœud du graphe routier : intersection, virage ou extrémité. */
public final class RoadNode {
    public final int id;
    public final double x;
    public final double z;
    public double y;
    public final List<Integer> edges = new ArrayList<>();
    /** Feu tricolore (degré ≥ 3, hors routes de colline). */
    public boolean light;

    public double lightOffset;
    /** Demi-taille de la zone d'intersection (0 pour un virage). */
    public double radius;
    /** Intersection alignée sur la grille (dalle carrée) ou d'angle libre (disque). */
    public boolean square = true;

    RoadNode(int id, double x, double z) {
        this.id = id;
        this.x = x;
        this.z = z;
    }
}
