package fr.tikigaming.games.bang.cards;

/** Les quatre cartes Rôle : leur nom et l'objectif affiché une fois la carte révélée. */
public enum Role {
    SHERIFF("Shérif", "Doit éliminer tous les hors-la-loi et le Renégat pour faire régner la loi."),
    DEPUTY(
            "Adjoint",
            "Aident et protègent le Shérif. Ils ont le même but que lui et ils l'accompliront coûte que coûte."),
    OUTLAW(
            "Hors-la-loi",
            "Ont envie de tuer le Shérif, mais ils n'ont aucun scrupule à s'entretuer pour ramasser les récompenses."),
    RENEGADE("Renégat", "Veut prendre la place du Shérif : son but est d'être le dernier personnage en jeu.");

    private final String label;
    private final String goal;

    Role(String label, String goal) {
        this.label = label;
        this.goal = goal;
    }

    public String label() {
        return label;
    }

    public String goal() {
        return goal;
    }
}
