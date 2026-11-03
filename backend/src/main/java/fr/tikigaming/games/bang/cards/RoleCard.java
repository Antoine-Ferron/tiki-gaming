package fr.tikigaming.games.bang.cards;

/** Une carte Rôle, face cachée ou visible. Face cachée, les quatre cartes montrent le même dos. */
public record RoleCard(Role role, boolean faceUp) {

    /** Ce que voit un joueur : le dos commun (vide) ou le nom et l'objectif du rôle. */
    public record Face(String name, String goal) {}

    public static final Face BACK = new Face("", "");

    public Face face() {
        return faceUp ? new Face(role.label(), role.goal()) : BACK;
    }

    public RoleCard reveal() {
        return new RoleCard(role, true);
    }
}
