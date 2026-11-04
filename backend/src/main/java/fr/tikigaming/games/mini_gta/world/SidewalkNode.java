package fr.tikigaming.games.mini_gta.world;

import java.util.ArrayList;
import java.util.List;

/** Nœud du graphe des trottoirs (coins d'îlots), relié par les passages piétons. */
public final class SidewalkNode {
    public final int id;
    public final double x;
    public final double z;
    public final double y;
    public final List<Integer> links = new ArrayList<>();

    public SidewalkNode(int id, double x, double z, double y) {
        this.id = id;
        this.x = x;
        this.z = z;
        this.y = y;
    }
}
