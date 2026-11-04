package fr.tikigaming.games.mini_gta.world;

/**
 * Bâtiment : centre et demi-étendues locales (avant rotation). Mutable, car les bâtiments
 * spéciaux sont retaillés et déplacés après coup.
 */
public final class Building {
    /** Étage supérieur en retrait (tour). */
    public record Tier(double hw, double hd, double h) {}

    public int id;
    public double x;
    public double z;
    public double hw;
    public double hd;
    public double y0;
    public double h;
    public double rot;
    public FacadeStyle style;
    public double[] color;
    public Roof roof;
    public Tier tier;
    public SpecialKind special;
    /** Bâtiments creux (intérieur et porte). Côté de la porte : 0 = -z, 1 = +x, 2 = +z, 3 = -x. */
    public Integer doorSide;
    /**
     * Hauteur du rez-de-chaussée creux d'un bâtiment ordinaire où l'on peut entrer (null : tout le bâtiment est
     * creux, cas des bâtiments spéciaux). Les étages au-dessus restent pleins.
     */
    public Double floorHeight;
    /** Parcelle du bâtiment (bâtiments de la ville uniquement). */
    public Rect lot;

    public int chunk;

    Building(
            double x,
            double z,
            double hw,
            double hd,
            double y0,
            double h,
            double rot,
            FacadeStyle style,
            double[] color,
            Roof roof,
            Tier tier) {
        this.x = x;
        this.z = z;
        this.hw = hw;
        this.hd = hd;
        this.y0 = y0;
        this.h = h;
        this.rot = rot;
        this.style = style;
        this.color = color;
        this.roof = roof;
        this.tier = tier;
    }
}
