package fr.tikigaming.games.mini_gta.progress;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.ArrayList;
import java.util.List;

/**
 * Progression du joueur, au format de la sauvegarde du front ({@code frontend/src/games/mini-gta/domain/save.ts}).
 * Le serveur ne la stocke pas : le client l'envoie avec chaque transaction et sauvegarde celle qui lui est
 * renvoyée.
 *
 * @param totalEarned argent gagné depuis le début de la partie, jamais diminué par les dépenses (c'est le score)
 * @param inventory armes possédées, ou {@code null} pour l'inventaire de départ ; renvoyé tel quel
 */
public record Progress(
        @Schema(example = "1")
        @NotNull(message = "Sauvegarde d'un format inconnu.")
        @Min(value = 1, message = Progress.UNKNOWN_FORMAT_MESSAGE)
        @Max(value = 1, message = Progress.UNKNOWN_FORMAT_MESSAGE)
        Integer version,

        @Schema(example = "1200") @PositiveOrZero(message = "Le solde ne peut pas être négatif.")
        int money,

        @Schema(example = "3400") @PositiveOrZero(message = "Les gains ne peuvent pas être négatifs.")
        int totalEarned,

        @Schema(example = "50")
        @Min(value = 0, message = Progress.ARMOR_RANGE_MESSAGE)
        @Max(value = 100, message = Progress.ARMOR_RANGE_MESSAGE)
        int armor,

        @Valid List<@NotNull @Valid Slot> inventory,

        @Schema(example = "[\"express\"]") @NotNull(message = "Liste des missions terminées attendue.")
        List<@NotNull String> completedMissions,

        @NotNull(message = "Statistiques attendues.") @Valid Stats stats) {

    /** Plafond des gains cumulés, donc du score (R8), aligné avec {@code games.max_score}. */
    public static final int MAX_EARNED = 1_000_000;

    static final String UNKNOWN_FORMAT_MESSAGE = "Sauvegarde d'un format inconnu.";
    static final String ARMOR_RANGE_MESSAGE = "L'armure doit être comprise entre 0 et 100.";

    /** Arme possédée : {@code clip} est le chargeur engagé, {@code ammo} la réserve. */
    public record Slot(
            @Schema(example = "pistol")
            @NotNull(message = Slot.UNKNOWN_WEAPON)
            @Pattern(regexp = "fists|bat|pistol|rifle|shotgun|sniper|grenade", message = Slot.UNKNOWN_WEAPON)
            String id,

            @Schema(example = "12") @PositiveOrZero(message = Slot.NEGATIVE_AMMO)
            int clip,

            @Schema(example = "48") @PositiveOrZero(message = Slot.NEGATIVE_AMMO)
            int ammo) {

        static final String UNKNOWN_WEAPON = "Arme inconnue.";
        static final String NEGATIVE_AMMO = "Les munitions ne peuvent pas être négatives.";
    }

    public record Stats(
            @Schema(example = "3") @PositiveOrZero(message = "Statistiques invalides.")
            int kills,

            @Schema(example = "2") @PositiveOrZero(message = "Statistiques invalides.")
            int wantedMax,

            @Schema(example = "125.5") @PositiveOrZero(message = "Statistiques invalides.")
            double playTime) {}

    /** Nouvelle partie : 500 $, rien de gagné, aucune mission. */
    public static Progress initial() {
        return new Progress(1, 500, 0, 0, null, List.of(), new Stats(0, 0, 0));
    }

    Progress withMoney(int amount) {
        return new Progress(version, amount, totalEarned, armor, inventory, completedMissions, stats);
    }

    /** Ajoute un gain : il compte dans le solde et dans les gains cumulés, plafonnés à {@link #MAX_EARNED}. */
    Progress earn(int amount) {
        int balance = (int) Math.min(Integer.MAX_VALUE, (long) money + amount);
        int earned = (int) Math.max(totalEarned, Math.min(MAX_EARNED, (long) totalEarned + amount));
        return new Progress(version, balance, earned, armor, inventory, completedMissions, stats);
    }

    /** Débite une dépense ; le solde ne descend jamais sous 0 et les gains cumulés ne bougent pas. */
    Progress pay(int amount) {
        return withMoney(Math.max(0, money - amount));
    }

    Progress complete(String missionId) {
        List<String> done = new ArrayList<>(completedMissions);
        done.add(missionId);
        return new Progress(version, money, totalEarned, armor, inventory, List.copyOf(done), stats);
    }
}
