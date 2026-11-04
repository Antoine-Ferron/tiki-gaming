package fr.tikigaming.games.mini_gta.weapons;

/**
 * Caractéristiques d'une arme.
 *
 * @param interval secondes entre deux tirs
 * @param spread demi-angle du cône de dispersion en visée (rad)
 * @param zoomFov champ de vision de la caméra en visée
 * @param noise rayon du bruit (panique des piétons, police alertée)
 */
public record WeaponDef(
        String label,
        int slot,
        Holding holding,
        double damage,
        double interval,
        int magazine,
        double reload,
        boolean auto,
        double spread,
        double range,
        int pellets,
        double zoomFov,
        boolean melee,
        boolean thrown,
        int price,
        int ammoPrice,
        int ammoPack,
        double noise) {}
