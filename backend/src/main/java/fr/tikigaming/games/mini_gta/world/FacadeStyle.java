package fr.tikigaming.games.mini_gta.world;

/** Styles de façade compris par le shader (valeur de {@code aInfo.x}). */
public enum FacadeStyle {
    GLASS_TOWER,
    OFFICE,
    BRICK,
    HOUSE,
    WAREHOUSE,
    SHOP;

    public int code() {
        return ordinal();
    }
}
