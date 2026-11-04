package fr.tikigaming.games.sdv_civilisation;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Prix des constructions, voir docs/games/sdv-civilisation/regles.md#commerce : le joueur utilise d'abord sa
 * production, puis achète au voisin de gauche, puis à celui de droite, dans la limite de ce qu'ils produisent.
 * Tout est calculé sur l'état de début de tour : les pièces reçues pendant le tour ne servent pas à payer.
 */
public final class Payments {

    private Payments() {}

    /** Construire un bâtiment : jamais deux fois le même, gratuit par chaîne, sinon payé. */
    public static Payment build(GameState state, int index, Card card, CurrencyConverter converter) {
        PlayerState player = state.player(index);
        if (player.hasBuilt(card.name())) return Payment.refused(Refusal.BUILT);
        if (card.chainFrom() != null && player.hasBuilt(card.chainFrom())) return Payment.CHAIN;
        return pay(state, index, card.cost(), converter);
    }

    /** Bâtir l'étape suivante de sa merveille : on paie le coût de l'étape, la carte ne sert que de support. */
    public static Payment wonder(GameState state, int index, CurrencyConverter converter) {
        return state.player(index)
                .nextStage()
                .map(stage -> pay(state, index, stage.cost(), converter))
                .orElse(Payment.refused(Refusal.WONDER));
    }

    /** Ressources de la prochaine étape de merveille, une par une (aucune si elle est terminée). */
    public static List<ResourceNeed> wonderNeeds(GameState state, int index) {
        return state.player(index)
                .nextStage()
                .map(stage -> breakdown(state, index, stage.cost()))
                .orElse(List.of());
    }

    /** Détail d'un coût, ressource par ressource. */
    public static List<ResourceNeed> breakdown(GameState state, int index, Cost cost) {
        Map<Resource, Long> own = count(state.player(index).production());
        Map<Resource, Long> left = count(state.left(index).production());
        Map<Resource, Long> right = count(state.right(index).production());
        return count(cost.resources()).entrySet().stream()
                .map(entry -> {
                    Resource resource = entry.getKey();
                    int needed = entry.getValue().intValue();
                    int mine = Math.min(needed, own.getOrDefault(resource, 0L).intValue());
                    int fromLeft = Math.min(
                            needed - mine, left.getOrDefault(resource, 0L).intValue());
                    int fromRight = Math.min(
                            needed - mine - fromLeft,
                            right.getOrDefault(resource, 0L).intValue());
                    return new ResourceNeed(
                            resource, needed, mine, fromLeft, fromRight, needed - mine - fromLeft - fromRight);
                })
                .toList();
    }

    private static Payment pay(GameState state, int index, Cost cost, CurrencyConverter converter) {
        int toLeft = 0;
        int toRight = 0;
        for (ResourceNeed need : breakdown(state, index, cost)) {
            if (need.missing() > 0) return Payment.refused(Refusal.RESOURCES);
            if (need.fromLeft() > 0) toLeft += converter.toCoins(need.resource(), need.fromLeft());
            if (need.fromRight() > 0) toRight += converter.toCoins(need.resource(), need.fromRight());
        }
        int coins = cost.coins() + toLeft + toRight;
        if (coins > state.player(index).coins()) return Payment.refused(Refusal.COINS);
        return Payment.paid(coins, toLeft, toRight);
    }

    private static Map<Resource, Long> count(List<Resource> resources) {
        return resources.stream()
                .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()));
    }
}
