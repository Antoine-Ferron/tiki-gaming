package fr.tikigaming.games.sdv_civilisation;

/** Points des cartes vertes, voir docs/games/sdv-civilisation/regles.md#science */
public final class ScienceScore {

    public static final int POINTS_PER_SET = 7;

    private ScienceScore() {}

    public static int compute(int tablets, int gears, int compasses) {
        if (tablets < 0 || gears < 0 || compasses < 0) {
            throw new IllegalArgumentException("Un nombre de symboles ne peut pas être négatif");
        }
        int completeSets = Math.min(tablets, Math.min(gears, compasses));
        return tablets * tablets + gears * gears + compasses * compasses + POINTS_PER_SET * completeSets;
    }
}
