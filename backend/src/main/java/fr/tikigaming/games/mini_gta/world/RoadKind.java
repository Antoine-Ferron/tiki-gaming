package fr.tikigaming.games.mini_gta.world;

/** Types de route : nombre de voies par sens, largeur totale (m) et vitesse de référence (m/s). */
public enum RoadKind {
    STREET(1, 12, 13),
    AVENUE(2, 19, 16),
    HIGHWAY(2, 17, 24),
    HILL(1, 9, 12);

    public final int lanes;
    public final double width;
    public final double speed;

    RoadKind(int lanes, double width, double speed) {
        this.lanes = lanes;
        this.width = width;
        this.speed = speed;
    }
}
