package fr.tikigaming.games.sdv_civilisation;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

/**
 * Moteur de la partie contre deux IA, arbitré par le serveur. Voir docs/games/sdv-civilisation/regles.md
 * Le mélangeur, le prix du commerce et le journal d'audit sont injectés : aléatoires et réels en production,
 * figés dans les tests.
 */
public final class Engine {

    public static final int STARTING_COINS = 3;
    public static final int HAND_SIZE = 7;
    static final List<String> BOTS = List.of("IA 1", "IA 2");

    private final CurrencyConverter converter;
    private final Shuffler shuffler;
    private final AuditNotifier audit;

    public Engine(CurrencyConverter converter, Shuffler shuffler, AuditNotifier audit) {
        this.converter = converter;
        this.shuffler = shuffler;
        this.audit = audit;
    }

    /** Mise en place : le joueur prend la merveille choisie, les IA reçoivent au hasard deux des autres. */
    public GameState create(String player, Wonder chosen) {
        List<Wonder> others = shuffler.shuffle(
                Wonders.ALL.stream().filter(w -> !w.equals(chosen)).toList());
        List<PlayerState> players = new ArrayList<>();
        players.add(PlayerState.seat(player, false, STARTING_COINS, chosen));
        for (int i = 0; i < BOTS.size(); i++) {
            players.add(PlayerState.seat(BOTS.get(i), true, STARTING_COINS, others.get(i)));
        }
        return new GameState(1, 1, players, deal(1, players.size()), false, List.of(), List.of(), List.of());
    }

    /** Distribue 7 cartes de l'âge à chaque joueur : chaque carte existe en un exemplaire par joueur. */
    private List<List<Card>> deal(int age, int playerCount) {
        List<Card> deck = shuffler.shuffle(IntStream.range(0, playerCount)
                .boxed()
                .flatMap(i -> Cards.ofAge(age).stream())
                .toList());
        return IntStream.range(0, playerCount)
                .mapToObj(i -> deck.subList(i * HAND_SIZE, (i + 1) * HAND_SIZE))
                .toList();
    }
}
