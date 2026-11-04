package fr.tikigaming.games.yams;

/** Total d'une feuille de Yams : section haute + bonus + section basse (même règle que le front). */
public final class YamsScore {

    public static final int BONUS_THRESHOLD = 63;
    public static final int BONUS = 35;

    private YamsScore() {}

    public static int total(int upperSubtotal, int lowerSubtotal) {
        if (upperSubtotal < 0 || lowerSubtotal < 0) {
            throw new IllegalArgumentException("Un sous-total ne peut pas être négatif");
        }
        int bonus = upperSubtotal >= BONUS_THRESHOLD ? BONUS : 0;
        return upperSubtotal + bonus + lowerSubtotal;
    }
}
