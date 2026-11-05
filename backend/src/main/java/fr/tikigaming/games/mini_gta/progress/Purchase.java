package fr.tikigaming.games.mini_gta.progress;

/**
 * Résultat d'un achat à l'armurerie.
 *
 * @param rounds munitions à ajouter à l'inventaire du joueur (0 pour le gilet ou un achat refusé)
 */
public record Purchase(boolean ok, int price, int rounds, Progress progress) {
    public enum Item {
        WEAPON,
        AMMO,
        ARMOR
    }
}
