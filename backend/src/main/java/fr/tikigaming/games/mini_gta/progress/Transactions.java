package fr.tikigaming.games.mini_gta.progress;

import fr.tikigaming.games.mini_gta.missions.MissionDef;
import fr.tikigaming.games.mini_gta.weapons.WeaponDef;
import fr.tikigaming.games.mini_gta.weapons.WeaponId;

/**
 * Règles d'argent du jeu, appliquées par le serveur à la progression envoyée par le client : récompenses de
 * mission, armurerie et frais de réapparition. Fonctions pures, sans état.
 */
public final class Transactions {
    static final int ARMOR_PRICE = 250;

    private Transactions() {}

    /** Paie la récompense et marque la mission terminée ; une mission déjà terminée ne paie plus rien. */
    public static MissionReward completeMission(Progress progress, MissionDef mission) {
        if (progress.completedMissions().contains(mission.id())) return new MissionReward(false, 0, progress);
        Progress paid = progress.earn(mission.reward()).complete(mission.id());
        return new MissionReward(true, mission.reward(), paid);
    }

    /** Vrai si l'armurerie vend cet article : ni les poings, ni de munitions pour une arme blanche. */
    public static boolean sells(Purchase.Item item, WeaponId weapon) {
        if (item == Purchase.Item.ARMOR) return true;
        if (weapon == null || weapon == WeaponId.FISTS) return false;
        return item == Purchase.Item.WEAPON || !weapon.def().melee();
    }

    /**
     * Achat à l'armurerie : refusé (sans débit) si le solde ne couvre pas le prix.
     *
     * @throws IllegalArgumentException si l'article n'est pas vendu (voir {@link #sells})
     */
    public static Purchase purchase(Progress progress, Purchase.Item item, WeaponId weapon) {
        if (!sells(item, weapon)) throw new IllegalArgumentException("Article non vendu : " + item + " " + weapon);
        int price;
        int rounds;
        if (item == Purchase.Item.ARMOR) {
            price = ARMOR_PRICE;
            rounds = 0;
        } else {
            WeaponDef def = weapon.def();
            if (item == Purchase.Item.WEAPON) {
                price = def.price();
                rounds = def.thrown() ? def.ammoPack() : def.magazine() * 2;
            } else {
                price = def.ammoPrice();
                rounds = def.ammoPack();
            }
        }
        if (progress.money() < price) return new Purchase(false, price, 0, progress);
        return new Purchase(true, price, rounds, progress.pay(price));
    }

    /** Frais d'hôpital (10 %, 100 $ minimum) ou caution (15 %, 200 $ minimum). */
    public static Respawn respawn(Progress progress, Respawn.Reason reason) {
        int money = progress.money();
        int fee = reason == Respawn.Reason.DEAD
                ? (int) Math.max(100, Math.round(money * 0.1))
                : (int) Math.max(200, Math.round(money * 0.15));
        return new Respawn(fee, progress.pay(fee));
    }
}
