package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.List;
import java.util.function.IntBinaryOperator;

/**
 * Règles du tir (BANG ! et Raté !). Chaque règle renvoie un nouvel état sans modifier l'ancien : une action
 * refusée lève une exception et la carte reste en main.
 */
public class ShotRules {

    private static final int BASE_RANGE = 1;

    private final IntBinaryOperator distance;
    private final CardDraw cardDraw;

    /** @param distance distance entre deux sièges (#58) */
    public ShotRules(IntBinaryOperator distance) {
        this(distance, new CardDraw());
    }

    ShotRules(IntBinaryOperator distance, CardDraw cardDraw) {
        this.distance = distance;
        this.cardDraw = cardDraw;
    }

    /** Le joueur au tour {@code shooterSeat} joue un BANG ! sur {@code targetSeat}. {@code shotsThisTurn} : tirs déjà faits. */
    public ShotOutcome fire(GameState state, int shooterSeat, String cardId, int targetSeat, int shotsThisTurn) {
        GameState.Player shooter = player(state, shooterSeat);
        GameState.Player target = player(state, targetSeat);
        if (state.currentSeat() != shooterSeat) {
            throw new IllegalStateException("Ce n'est pas le tour de ce joueur");
        }
        if (shooterSeat == targetSeat || target.health() <= 0) {
            throw new IllegalArgumentException("Cible invalide");
        }
        if (shotsThisTurn >= shooter.character().maxBangsPerTurn()) {
            throw new IllegalStateException("Un seul BANG ! par tour");
        }
        if (target.character().distanceAsTarget(distance.applyAsInt(shooterSeat, targetSeat)) > BASE_RANGE) {
            throw new IllegalStateException("La cible est hors de portée");
        }
        return discard(state, shooter, usableAs(shooter, cardId, CardType.BANG));
    }

    /** La cible joue un Raté ! ({@code missedCardId}) ou, si {@code null}, accepte le tir et perd 1 PV. */
    public ShotOutcome respond(GameState state, int targetSeat, String missedCardId) {
        GameState.Player target = player(state, targetSeat);
        if (missedCardId != null) {
            return discard(state, target, usableAs(target, missedCardId, CardType.MISSED));
        }
        int health = Math.max(0, target.health() - 1);
        int bonus = health > 0 ? target.character().cardsDrawnOnLifeLost(target.health() - health) : 0;
        GameState damaged = replace(state, withHealth(target, health));
        return new ShotOutcome(cardDraw.draw(damaged, targetSeat, bonus), List.of());
    }

    private static GameState.Player player(GameState state, int seat) {
        return state.players().stream()
                .filter(player -> player.seat() == seat)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Siège inconnu : " + seat));
    }

    /** La carte de la main du joueur, si son personnage peut la jouer comme {@code needed}. */
    private static CardInstance usableAs(GameState.Player player, String cardId, CardType needed) {
        return player.hand().stream()
                .filter(card -> card.id().equals(cardId))
                .filter(card -> player.character().canUseAs(card.type(), needed))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Carte indisponible : " + cardId));
    }

    private static ShotOutcome discard(GameState state, GameState.Player owner, CardInstance card) {
        List<CardInstance> hand =
                owner.hand().stream().filter(other -> !other.equals(card)).toList();
        GameState.Player updated = new GameState.Player(
                owner.accountId(),
                owner.seat(),
                owner.roleCard(),
                owner.character(),
                owner.health(),
                owner.maxHealth(),
                hand);
        return new ShotOutcome(replace(state, updated), List.of(card));
    }

    private static GameState.Player withHealth(GameState.Player player, int health) {
        return new GameState.Player(
                player.accountId(),
                player.seat(),
                player.roleCard(),
                player.character(),
                health,
                player.maxHealth(),
                player.hand());
    }

    private static GameState replace(GameState state, GameState.Player updated) {
        List<GameState.Player> players = state.players().stream()
                .map(player -> player.seat() == updated.seat() ? updated : player)
                .toList();
        return new GameState(players, state.drawPile(), state.discardPile(), state.currentSeat(), state.phase());
    }
}
