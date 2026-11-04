package fr.tikigaming.games.mini_gta.weapons;

/** Armes du jeu, dans l'ordre des emplacements. */
public enum WeaponId {
    FISTS(new WeaponDef("Poings", 0, Holding.NONE, 12, 0.45, 0, 0, false, 0, 1.6, 1, 60, true, false, 0, 0, 0, 0)),
    BAT(new WeaponDef("Batte", 1, Holding.MELEE, 34, 0.7, 0, 0, false, 0, 2.0, 1, 60, true, false, 100, 0, 0, 0)),
    PISTOL(new WeaponDef(
            "Pistolet", 2, Holding.PISTOL, 26, 0.22, 12, 1.2, false, 0.012, 120, 1, 52, false, false, 300, 60, 36, 60)),
    SHOTGUN(new WeaponDef(
            "Fusil à pompe",
            3,
            Holding.RIFLE,
            14,
            0.85,
            8,
            2.2,
            false,
            0.07,
            45,
            9,
            54,
            false,
            false,
            1200,
            120,
            24,
            80)),
    RIFLE(new WeaponDef(
            "Fusil d'assaut",
            4,
            Holding.RIFLE,
            22,
            0.1,
            30,
            1.8,
            true,
            0.018,
            180,
            1,
            45,
            false,
            false,
            1500,
            150,
            90,
            90)),
    SNIPER(new WeaponDef(
            "Sniper", 5, Holding.RIFLE, 120, 1.2, 5, 2.6, false, 0.001, 450, 1, 14, false, false, 2500, 200, 15, 120)),
    GRENADE(new WeaponDef(
            "Grenades", 6, Holding.THROW, 200, 1.0, 1, 0, false, 0, 30, 1, 60, false, true, 400, 400, 5, 150));

    private final WeaponDef def;

    WeaponId(WeaponDef def) {
        this.def = def;
    }

    public WeaponDef def() {
        return def;
    }
}
