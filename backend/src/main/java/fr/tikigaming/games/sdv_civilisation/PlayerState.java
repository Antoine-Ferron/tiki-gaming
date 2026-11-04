package fr.tikigaming.games.sdv_civilisation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Un joueur de la table. {@code stagesBuilt} : étapes de merveille bâties, dans l'ordre du plateau ;
 * {@code military} : somme des jetons de conflit ; {@code tokens} : chaque duel, voisin par voisin.
 * La production, les boucliers et les points de science sont calculés, envoyés au front mais jamais relus.
 */
@JsonIgnoreProperties(
        value = {"production", "shields"},
        allowGetters = true)
public record PlayerState(
        String name,
        @JsonProperty("isBot") boolean bot,
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
    @JsonProperty
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
    @JsonProperty
    public int shields() {
        return built.stream().mapToInt(Card::shields).sum()
                + builtStages().stream().mapToInt(WonderStage::shields).sum();
    }

    /** Le joueur après son action du tour : ses nouvelles pièces, et le bâtiment ou l'étape de merveille gagnés. */
    PlayerState afterTurn(int newCoins, ActionType type, Card card) {
        List<Card> city = type == ActionType.BUILD
                ? Stream.concat(built.stream(), Stream.of(card)).toList()
                : built;
        // Étape de merveille : la carte est posée face cachée sous le plateau, sans effet.
        int stages = stagesBuilt + (type == ActionType.WONDER ? 1 : 0);
        return new PlayerState(name, bot, newCoins, wonder, stages, city, military, tokens);
    }

    /** Le joueur après les duels de fin d'âge contre ses deux voisins. */
    PlayerState afterConflicts(List<MilitaryToken> duels) {
        int won = duels.stream().mapToInt(MilitaryToken::value).sum();
        List<MilitaryToken> all = Stream.concat(tokens.stream(), duels.stream()).toList();
        return new PlayerState(name, bot, coins, wonder, stagesBuilt, built, military + won, all);
    }

    /** Points de science : somme des carrés de chaque symbole + 7 par série complète. */
    @JsonProperty
    public int sciencePoints() {
        return ScienceScore.compute(
                symbols(ScienceSymbol.TABLET), symbols(ScienceSymbol.GEAR), symbols(ScienceSymbol.COMPASS));
    }

    private int symbols(ScienceSymbol symbol) {
        return (int) built.stream().filter(card -> card.science() == symbol).count();
    }

    public boolean hasBuilt(String card) {
        return built.stream().anyMatch(c -> c.name().equals(card));
    }
}
