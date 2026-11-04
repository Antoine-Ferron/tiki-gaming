package fr.tikigaming.games.sdv_civilisation;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Un joueur de la table. {@code stagesBuilt} : étapes de merveille bâties, dans l'ordre du plateau ;
 * {@code military} : somme des jetons de conflit ; {@code tokens} : chaque duel, voisin par voisin.
 */
public record PlayerState(
        String name,
        boolean bot,
        int coins,
        Wonder wonder,
        int stagesBuilt,
        List<Card> built,
        int military,
        List<MilitaryToken> tokens) {

    public PlayerState {
        built = List.copyOf(built);
        tokens = List.copyOf(tokens);
    }

    static PlayerState seat(String name, boolean bot, int coins, Wonder wonder) {
        return new PlayerState(name, bot, coins, wonder, 0, List.of(), 0, List.of());
    }

    /** Ressources produites : le plateau merveille, puis les cartes marron et grises. */
    public List<Resource> production() {
        return Stream.concat(Stream.of(wonder.resource()), built.stream().flatMap(card -> card.produces().stream()))
                .toList();
    }

    public List<WonderStage> builtStages() {
        return wonder.stages().subList(0, stagesBuilt);
    }

    /** Prochaine étape de la merveille, vide si elle est terminée. */
    public Optional<WonderStage> nextStage() {
        return stagesBuilt < wonder.stages().size()
                ? Optional.of(wonder.stages().get(stagesBuilt))
                : Optional.empty();
    }

    /** Puissance militaire : boucliers des cartes rouges et des étapes de merveille. */
    public int shields() {
        return built.stream().mapToInt(Card::shields).sum()
                + builtStages().stream().mapToInt(WonderStage::shields).sum();
    }

    public boolean hasBuilt(String card) {
        return built.stream().anyMatch(c -> c.name().equals(card));
    }
}
