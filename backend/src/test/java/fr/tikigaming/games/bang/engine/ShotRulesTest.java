package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.cards.RoleCard;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.List;
import java.util.function.IntBinaryOperator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

class ShotRulesTest {

    // Stub de la distance (#58) : quatre sièges en cercle.
    private static final IntBinaryOperator CIRCLE = (from, to) -> {
        int gap = Math.abs(from - to);
        return Math.min(gap, 4 - gap);
    };

    private final ShotRules rules = new ShotRules(CIRCLE);
    private final CardInstance bang = new CardInstance("bang-1", CardType.BANG);
    private final CardInstance missed = new CardInstance("missed-1", CardType.MISSED);

    private static GameState.Player player(int seat, BangCharacter character, int health, CardInstance... hand) {
        return new GameState.Player(
                "account-" + seat, seat, new RoleCard(Role.OUTLAW, false), character, health, 5, List.of(hand));
    }

    private static GameState state(int currentSeat, GameState.Player... players) {
        return new GameState(List.of(players), List.of(), List.of(), currentSeat, GameState.Phase.PLAY);
    }

    /** Siège 1 (au tour) tient un BANG !, siège 2 est son voisin, siège 3 est à distance 2. */
    private GameState table(CardInstance... targetHand) {
        return state(
                1,
                player(1, BangCharacter.BART_CASSIDY, 4, bang),
                player(2, BangCharacter.BART_CASSIDY, 4, targetHand),
                player(3, BangCharacter.BART_CASSIDY, 4),
                player(4, BangCharacter.BART_CASSIDY, 4));
    }

    private static GameState.Player seat(GameState state, int seat) {
        return state.players().stream()
                .filter(p -> p.seat() == seat)
                .findFirst()
                .orElseThrow();
    }

    // --- Tirer : BANG ! à portée, pendant son tour ---

    @Test
    void paulRegretsPowerIncreasesHisDistanceOnlyAsATarget() {
        GameState paulAsTarget =
                state(1, player(1, BangCharacter.BART_CASSIDY, 4, bang), player(2, BangCharacter.PAUL_REGRET, 3));
        assertThatThrownBy(() -> rules.fire(paulAsTarget, 1, "bang-1", 2, 0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("La cible est hors de portée");

        GameState paulAsShooter =
                state(1, player(1, BangCharacter.PAUL_REGRET, 3, bang), player(2, BangCharacter.BART_CASSIDY, 4));
        assertThat(rules.fire(paulAsShooter, 1, "bang-1", 2, 0).discarded()).containsExactly(bang);
    }

    @Test
    void bangAtANeighbourLeavesTheHandAndGoesToTheDiscardOnce() {
        ShotOutcome outcome = rules.fire(table(), 1, "bang-1", 2, 0);

        assertThat(seat(outcome.state(), 1).hand()).isEmpty();
        assertThat(outcome.discarded()).containsExactly(bang);
        assertThat(outcome.state().phase()).isEqualTo(GameState.Phase.PLAY);
    }

    @Test
    void bangBeyondTheBaseRangeIsRefusedAndStaysInHand() {
        GameState before = table();

        assertThatThrownBy(() -> rules.fire(before, 1, "bang-1", 3, 0)).isInstanceOf(IllegalStateException.class);

        assertThat(seat(before, 1).hand()).containsExactly(bang);
        assertThat(before).isEqualTo(table());
    }

    @Test
    void playingACardKeepsTheOtherCardsInHand() {
        CardInstance otherBang = new CardInstance("bang-2", CardType.BANG);
        GameState state = state(
                1,
                player(1, BangCharacter.BART_CASSIDY, 4, bang, otherBang, missed),
                player(2, BangCharacter.BART_CASSIDY, 4));

        ShotOutcome outcome = rules.fire(state, 1, "bang-1", 2, 0);

        assertThat(seat(outcome.state(), 1).hand()).containsExactly(otherBang, missed);
        assertThat(outcome.discarded()).containsExactly(bang);
    }

    @Test
    void shootingAtAnUnknownSeatIsRefused() {
        GameState state = table();

        assertThatThrownBy(() -> rules.fire(state, 1, "bang-1", 9, 0)).isInstanceOf(IllegalArgumentException.class);
    }

    // --- Un seul BANG ! par tour, sauf pouvoir de Willy le Kid ---

    @ParameterizedTest
    @CsvSource({"BART_CASSIDY, 0, true", "BART_CASSIDY, 1, false", "WILLY_THE_KID, 1, true", "WILLY_THE_KID, 5, true"})
    void aSecondBangInTheSameTurnIsRefusedUnlessWilly(BangCharacter shooter, int shotsThisTurn, boolean allowed) {
        GameState state = state(
                1,
                player(1, shooter, 4, bang),
                player(2, BangCharacter.BART_CASSIDY, 4),
                player(3, BangCharacter.BART_CASSIDY, 4),
                player(4, BangCharacter.BART_CASSIDY, 4));

        if (allowed) {
            assertThat(rules.fire(state, 1, "bang-1", 2, shotsThisTurn).discarded())
                    .containsExactly(bang);
        } else {
            assertThatThrownBy(() -> rules.fire(state, 1, "bang-1", 2, shotsThisTurn))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    // --- Entrées invalides ---

    @Test
    void onlyTheCurrentPlayerCanShoot() {
        GameState state = table();

        assertThatThrownBy(() -> rules.fire(state, 2, "bang-1", 1, 0)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void cannotShootYourselfOrADeadPlayer() {
        GameState state = state(
                1,
                player(1, BangCharacter.BART_CASSIDY, 4, bang),
                player(2, BangCharacter.BART_CASSIDY, 0),
                player(3, BangCharacter.BART_CASSIDY, 4),
                player(4, BangCharacter.BART_CASSIDY, 4));

        assertThatThrownBy(() -> rules.fire(state, 1, "bang-1", 1, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> rules.fire(state, 1, "bang-1", 2, 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void cannotShootWithACardThatIsNotAnAvailableBang() {
        GameState state = table();

        assertThatThrownBy(() -> rules.fire(state, 1, "unknown", 2, 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aMissedIsNotABangExceptForCalamityJanet() {
        GameState bart =
                state(1, player(1, BangCharacter.BART_CASSIDY, 4, missed), player(2, BangCharacter.BART_CASSIDY, 4));
        GameState janet =
                state(1, player(1, BangCharacter.CALAMITY_JANET, 4, missed), player(2, BangCharacter.BART_CASSIDY, 4));

        assertThatThrownBy(() -> rules.fire(bart, 1, "missed-1", 2, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThat(rules.fire(janet, 1, "missed-1", 2, 0).discarded()).containsExactly(missed);
    }

    // --- Répondre : Raté ! ou accepter le tir ---

    @Test
    void aMissedKeepsTheTargetsLifeAndGoesToTheDiscardOnce() {
        ShotOutcome outcome = rules.respond(table(missed), 2, "missed-1");

        assertThat(seat(outcome.state(), 2).health()).isEqualTo(4);
        assertThat(seat(outcome.state(), 2).hand()).isEmpty();
        assertThat(outcome.discarded()).containsExactly(missed);
    }

    // Valeurs limites : 2 PV -> 1 PV (vivant), 1 PV -> 0 PV (mort)
    @ParameterizedTest
    @CsvSource({"4, 3", "2, 1", "1, 0"})
    void acceptingTheShotCostsExactlyOneLifePoint(int health, int expected) {
        GameState state =
                state(1, player(1, BangCharacter.BART_CASSIDY, 4), player(2, BangCharacter.BART_CASSIDY, health));

        ShotOutcome outcome = rules.respond(state, 2, null);

        assertThat(seat(outcome.state(), 2).health()).isEqualTo(expected);
        assertThat(outcome.discarded()).isEmpty();
    }

    @Test
    void theTargetCannotAnswerWithACardItDoesNotHold() {
        GameState state = table();

        assertThatThrownBy(() -> rules.respond(state, 2, "missed-1")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void calamityJanetAnswersWithABangAsAMissed() {
        GameState state =
                state(1, player(1, BangCharacter.BART_CASSIDY, 4), player(2, BangCharacter.CALAMITY_JANET, 4, bang));

        ShotOutcome outcome = rules.respond(state, 2, "bang-1");

        assertThat(seat(outcome.state(), 2).health()).isEqualTo(4);
        assertThat(outcome.discarded()).containsExactly(bang);
    }

    @ParameterizedTest
    @EnumSource(GameState.Phase.class)
    void rebuildingAStatePreservesTheTurnAndBothPiles(GameState.Phase phase) {
        CardInstance draw = new CardInstance("draw", CardType.BANG);
        CardInstance discarded = new CardInstance("discarded", CardType.MISSED);
        GameState before = new GameState(table(missed).players(), List.of(draw), List.of(discarded), 1, phase);

        for (ShotOutcome outcome : List.of(
                rules.fire(before, 1, "bang-1", 2, 0),
                rules.respond(before, 2, "missed-1"),
                rules.respond(before, 2, null))) {
            assertThat(outcome.state().phase()).isEqualTo(phase);
            assertThat(outcome.state().currentSeat()).isEqualTo(1);
            assertThat(outcome.state().drawPile()).containsExactly(draw);
            assertThat(outcome.state().discardPile()).containsExactly(discarded);
        }
    }
}
