package fr.tikigaming.games.sdv_civilisation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

/**
 * Moteur de la partie contre deux IA, arbitré par le serveur. Voir docs/games/sdv-civilisation/regles.md
 * Le mélangeur, le prix du commerce et le journal d'audit sont injectés : aléatoires et réels en production,
 * figés dans les tests.
 */
public final class Engine {

    public static final int STARTING_COINS = 3;
    public static final int HAND_SIZE = 7;
    public static final int TURNS_PER_AGE = 6;
    public static final int DISCARD_COINS = 3;
    public static final int LAST_AGE = 3;
    /** Jeton de victoire de chaque âge ; une défaite vaut toujours −1, une égalité 0. */
    private static final List<Integer> VICTORY_TOKENS = List.of(1, 3, 5);

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

    /** Âges I et III : chaque main part au voisin de gauche (on reçoit celle de droite). Âge II : l'inverse. */
    public static boolean passesLeft(int age) {
        return age != 2;
    }

    /**
     * Joue un tour : toutes les actions sont vérifiées sur l'état de début de tour, puis appliquées en même temps.
     * Les pièces passent par le trésor et le commerce ({@link Treasury}, {@link Trade}).
     *
     * @throws GameRuleException si une action est impossible (message pour le joueur)
     */
    public GameState play(GameState state, List<Action> actions) {
        int count = state.players().size();
        List<Card> played = new ArrayList<>();
        List<List<Card>> rest = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Action action = actions.get(i);
            List<Card> hand = new ArrayList<>(state.hands().get(i));
            Card card = hand.stream()
                    .filter(c -> c.name().equals(action.card()))
                    .findFirst()
                    .orElseThrow(() -> new GameRuleException("Cette carte n'est pas dans ta main : " + action.card()));
            Payment payment = payment(state, i, action.type(), card);
            if (!payment.ok()) throw new GameRuleException(payment.reason());
            // Un seul exemplaire quitte la main, même si elle en contient deux.
            hand.remove(card);
            played.add(card);
            rest.add(hand);
        }

        Map<String, Integer> balances = new LinkedHashMap<>();
        state.players().forEach(p -> balances.put(p.name(), p.coins()));
        Treasury treasury = new Treasury(new MapTreasuryRegistry(balances), audit);
        Trade trade = new Trade(converter, treasury);
        for (int i = 0; i < count; i++) {
            settle(state, i, actions.get(i).type(), played.get(i), treasury, trade);
        }

        List<PlayerState> players = new ArrayList<>();
        List<Card> discards = new ArrayList<>(state.discards());
        List<TurnEvent> lastTurn = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ActionType type = actions.get(i).type();
            Card card = played.get(i);
            PlayerState before = state.player(i);
            PlayerState after = before.afterTurn(balances.get(before.name()), type, card);
            if (type == ActionType.DISCARD) discards.add(card);
            players.add(after);
            lastTurn.add(new TurnEvent(i, type, card, after.coins() - before.coins()));
        }
        List<List<Card>> passed = IntStream.range(0, count)
                .mapToObj(i -> rest.get(passesLeft(state.age()) ? state.rightOf(i) : state.leftOf(i)))
                .toList();
        if (state.turn() < TURNS_PER_AGE) {
            return new GameState(state.age(), state.turn() + 1, players, passed, false, discards, lastTurn, List.of());
        }

        // Fin d'âge : la dernière carte de chaque main est défaussée, puis les conflits sont résolus.
        passed.forEach(discards::addAll);
        List<List<MilitaryToken>> duels = IntStream.range(0, count)
                .mapToObj(i -> List.of(
                        duel(state.age(), players.get(i), players.get(state.leftOf(i))),
                        duel(state.age(), players.get(i), players.get(state.rightOf(i)))))
                .toList();
        List<PlayerState> fought = IntStream.range(0, count)
                .mapToObj(i -> players.get(i).afterConflicts(duels.get(i)))
                .toList();
        List<Integer> conflicts = duels.stream()
                .map(pair -> pair.stream().mapToInt(MilitaryToken::value).sum())
                .toList();
        if (state.age() == LAST_AGE) {
            List<List<Card>> empty =
                    fought.stream().<List<Card>>map(p -> List.of()).toList();
            return new GameState(state.age(), state.turn(), fought, empty, true, discards, lastTurn, conflicts);
        }
        int age = state.age() + 1;
        return new GameState(age, 1, fought, deal(age, count), false, discards, lastTurn, conflicts);
    }

    /** Duel contre un voisin : victoire selon l'âge, défaite −1, égalité 0. */
    private static MilitaryToken duel(int age, PlayerState player, PlayerState other) {
        int value = Integer.compare(player.shields(), other.shields());
        return new MilitaryToken(age, other.name(), value > 0 ? VICTORY_TOKENS.get(age - 1) : Math.min(value, 0));
    }

    private Payment payment(GameState state, int index, ActionType type, Card card) {
        return switch (type) {
            case BUILD -> Payments.build(state, index, card, converter);
            case WONDER -> Payments.wonder(state, index, converter);
            case DISCARD -> Payment.paid(0, 0, 0);
        };
    }

    /** Pièces du tour : coût en pièces, achats aux voisins, puis gain immédiat (carte jaune, étape, défausse). */
    private static void settle(GameState state, int index, ActionType type, Card card, Treasury treasury, Trade trade) {
        PlayerState player = state.player(index);
        if (type == ActionType.DISCARD) {
            treasury.credit(player.name(), DISCARD_COINS);
            return;
        }
        boolean building = type == ActionType.BUILD;
        WonderStage stage = building ? null : player.nextStage().orElseThrow();
        if (!(building && Payments.chained(player, card))) {
            Cost cost = building ? card.cost() : stage.cost();
            if (cost.coins() > 0) treasury.debit(player.name(), cost.coins());
            for (ResourceNeed need : Payments.breakdown(state, index, cost)) {
                buy(trade, player, state.left(index), need.resource(), need.fromLeft());
                buy(trade, player, state.right(index), need.resource(), need.fromRight());
            }
        }
        int gain = building ? card.coins() : stage.coins();
        if (gain > 0) treasury.credit(player.name(), gain);
    }

    private static void buy(Trade trade, PlayerState buyer, PlayerState seller, Resource resource, int quantity) {
        if (quantity > 0) trade.buy(new Purchase(buyer.name(), seller.name(), resource, quantity));
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
