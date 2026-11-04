package fr.tikigaming.games.sdv_civilisation;

import java.util.Comparator;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/** Score final et classement, voir docs/games/sdv-civilisation/regles.md#score */
public final class Scoring {

    static final int COINS_PER_TREASURY_POINT = 3;

    private Scoring() {}

    /** Score final du joueur {@code index} : les guildes comptent des cartes chez ses deux voisins. */
    public static ScoreBreakdown finalScore(GameState state, int index) {
        PlayerState player = state.player(index);
        int military = player.military();
        int treasury = player.coins() / COINS_PER_TREASURY_POINT;
        int wonder = player.builtStages().stream().mapToInt(WonderStage::points).sum();
        int civil = player.built().stream().mapToInt(Card::points).sum();
        int science = ScienceScore.compute(
                symbols(player, ScienceSymbol.TABLET),
                symbols(player, ScienceSymbol.GEAR),
                symbols(player, ScienceSymbol.COMPASS));
        List<Card> neighbours = Stream.concat(state.left(index).built().stream(), state.right(index).built().stream())
                .toList();
        int guilds = player.built().stream()
                .mapToInt(guild -> (int) neighbours.stream()
                        .filter(card -> guild.guild().contains(card.color()))
                        .count())
                .sum();
        return new ScoreBreakdown(
                military,
                treasury,
                wonder,
                civil,
                science,
                guilds,
                military + treasury + wonder + civil + science + guilds);
    }

    /** Classement final : le plus haut total gagne ; à égalité, celui qui a le plus de pièces. */
    public static List<Ranked> ranking(GameState state) {
        return IntStream.range(0, state.players().size())
                .mapToObj(i -> {
                    PlayerState p = state.player(i);
                    return new Ranked(p.name(), p.bot(), p.coins(), finalScore(state, i));
                })
                .sorted(Comparator.comparingInt((Ranked r) -> r.score().total())
                        .thenComparingInt(Ranked::coins)
                        .reversed())
                .toList();
    }

    private static int symbols(PlayerState player, ScienceSymbol symbol) {
        return (int)
                player.built().stream().filter(card -> card.science() == symbol).count();
    }
}
