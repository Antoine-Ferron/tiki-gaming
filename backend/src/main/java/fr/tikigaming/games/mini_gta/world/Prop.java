package fr.tikigaming.games.mini_gta.world;

/** Mobilier urbain instancié et destructible. */
public final class Prop {
    public final int id;
    public final PropKind kind;
    public final double x;
    public final double y;
    public final double z;
    public final double rot;
    public final double scale;
    public final int chunk;
    public boolean destroyed;
    /** Feux tricolores : le carrefour et le tronçon d'approche. */
    public final Integer node;

    public final Integer edge;

    Prop(int id, PropKind kind, double x, double y, double z, double rot, double scale, Integer node, Integer edge) {
        this.id = id;
        this.kind = kind;
        this.x = x;
        this.y = y;
        this.z = z;
        this.rot = rot;
        this.scale = scale;
        this.chunk = WorldConstants.chunkIndexOf(x, z);
        this.node = node;
        this.edge = edge;
    }
}
