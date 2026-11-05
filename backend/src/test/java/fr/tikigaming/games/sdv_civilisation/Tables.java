package fr.tikigaming.games.sdv_civilisation;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.UnaryOperator;
import java.util.stream.IntStream;

/**
 * Constructeur de données de test : prépare une table précise en une ligne (qui a quelle merveille, quels
 * bâtiments, quelles pièces, quelle main), pour que chaque test ne montre que ce qui compte pour sa règle.
 *
 * <p>Paquet non mélangé : avec {@code start("Citadelle d’Orkan")}, "IA 1" (voisin de droite d'alice) a le Temple
 * d’Ysar (minerai) et "IA 2" (voisin de gauche) le Phare de Sélène (verre).
 */
public final class Tables {

    public static final int ALICE = 0;
    public static final int IA_1 = 1;
    public static final int IA_2 = 2;

    private Tables() {}

    public static GameState start(String wonder) {
        return new Engine(Dummy.converter(), FixedShuffler.KEEP, Dummy.audit()).create("alice", Wonders.byName(wonder));
    }

    public static Card card(String name) {
        return IntStream.rangeClosed(1, 3)
                .mapToObj(Cards::ofAge)
                .flatMap(List::stream)
                .filter(card -> card.name().equals(name))
                .findFirst()
                .orElseThrow();
    }

    public static GameState player(GameState state, int index, UnaryOperator<PlayerState> change) {
        List<PlayerState> players = new ArrayList<>(state.players());
        players.set(index, change.apply(players.get(index)));
        return new GameState(
                state.age(),
                state.turn(),
                players,
                state.hands(),
                state.over(),
                state.discards(),
                state.lastTurn(),
                state.conflicts());
    }

    public static UnaryOperator<PlayerState> built(String... cards) {
        return p -> new PlayerState(
                p.name(),
                p.bot(),
                p.coins(),
                p.wonder(),
                p.stagesBuilt(),
                Arrays.stream(cards).map(Tables::card).toList(),
                p.military(),
                p.tokens());
    }

    public static UnaryOperator<PlayerState> coins(int coins) {
        return p -> new PlayerState(
                p.name(), p.bot(), coins, p.wonder(), p.stagesBuilt(), p.built(), p.military(), p.tokens());
    }

    public static UnaryOperator<PlayerState> military(int military) {
        return p -> new PlayerState(
                p.name(), p.bot(), p.coins(), p.wonder(), p.stagesBuilt(), p.built(), military, p.tokens());
    }

    public static UnaryOperator<PlayerState> stages(int stagesBuilt) {
        return p -> new PlayerState(
                p.name(), p.bot(), p.coins(), p.wonder(), stagesBuilt, p.built(), p.military(), p.tokens());
    }

    public static GameState hand(GameState state, int index, String... cards) {
        List<List<Card>> hands = new ArrayList<>(state.hands());
        hands.set(index, Arrays.stream(cards).map(Tables::card).toList());
        return new GameState(
                state.age(),
                state.turn(),
                state.players(),
                hands,
                state.over(),
                state.discards(),
                state.lastTurn(),
                state.conflicts());
    }

    public static GameState age(GameState state, int age, int turn) {
        return new GameState(
                age,
                turn,
                state.players(),
                state.hands(),
                state.over(),
                state.discards(),
                state.lastTurn(),
                state.conflicts());
    }
}
