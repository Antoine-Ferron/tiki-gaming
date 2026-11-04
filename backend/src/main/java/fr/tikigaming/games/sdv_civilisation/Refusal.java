package fr.tikigaming.games.sdv_civilisation;

/** Pourquoi une construction est impossible, avec la phrase affichée au joueur. */
public enum Refusal implements LowercaseJson {
    BUILT("Tu as déjà construit cette carte."),
    RESOURCES("Il te manque des ressources."),
    COINS("Pas assez de pièces."),
    WONDER("Ta merveille est déjà terminée.");

    private final String reason;

    Refusal(String reason) {
        this.reason = reason;
    }

    public String reason() {
        return reason;
    }
}
