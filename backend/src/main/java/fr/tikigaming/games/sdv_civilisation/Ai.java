package fr.tikigaming.games.sdv_civilisation;

import java.util.Comparator;
import java.util.List;

/**
 * IA basique : construit le bâtiment payable le plus intéressant ; sinon bâtit une étape de sa merveille avec la
 * carte la moins intéressante ; sinon la défausse.
 */
public final class Ai {

    private Ai() {}

    public static Action choose(GameState state, int index, CurrencyConverter converter) {
        List<Card> byValue = state.hands().get(index).stream()
                .sorted(Comparator.comparingDouble(Ai::value).reversed())
                .toList();
        return byValue.stream()
                .filter(card -> Payments.build(state, index, card, converter).ok())
                .findFirst()
                .map(best -> new Action(ActionType.BUILD, best.name()))
                .orElseGet(() -> {
                    String worst = byValue.getLast().name();
                    boolean stage = Payments.wonder(state, index, converter).ok();
                    return new Action(stage ? ActionType.WONDER : ActionType.DISCARD, worst);
                });
    }

    /** Intérêt d'une carte : points, boucliers, science et guildes d'abord, puis ressources et pièces. */
    private static double value(Card card) {
        return card.points()
                + 2.0 * card.shields()
                + (card.science() != null ? 3 : 0)
                + (card.guild().isEmpty() ? 0 : 3)
                + card.produces().size()
                + card.coins() / 3.0;
    }
}
