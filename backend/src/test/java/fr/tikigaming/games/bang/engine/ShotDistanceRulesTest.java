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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ShotDistanceRulesTest {
    private final CardInstance bang = new CardInstance("bang-1", CardType.BANG);

    @Test
    void anOppositeLivingTargetIsOutOfRangeAndTheBangStaysInHand() {
        GameState before = table();

        assertThatThrownBy(() -> rulesFor(before).fire(before, 1, bang.id(), 3, 0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("La cible est hors de portée");

        assertThat(before).isEqualTo(table());
        assertThat(before.players().getFirst().hand()).containsExactly(bang);
    }

    @Test
    void theLastSeatIsANeighbourAcrossTheEndOfTheTable() {
        GameState before = table();

        ShotOutcome outcome = rulesFor(before).fire(before, 1, bang.id(), 4, 0);

        assertThat(outcome.state().players().getFirst().hand()).isEmpty();
        assertThat(outcome.discarded()).containsExactly(bang);
        assertThat(before).isEqualTo(table());
    }

    @Test
    void anEliminationBringsTheOppositeTargetIntoRangeWithoutLosingTheRefusedBang() {
        GameState before = table(1, 4);
        ShotRules rules = rulesFor(before);
        assertThatThrownBy(() -> rules.fire(before, 1, bang.id(), 3, 0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("La cible est hors de portée");
        assertThat(before.players().getFirst().hand()).containsExactly(bang);

        GameState afterElimination = rules.respond(before, 2, null).state();
        ShotOutcome outcome = rulesFor(afterElimination).fire(afterElimination, 1, bang.id(), 3, 0);

        assertThat(outcome.discarded()).containsExactly(bang);
        assertThat(outcome.state().players().getFirst().hand()).isEmpty();
        assertThat(afterElimination.players())
                .extracting(GameState.Player::seat)
                .containsExactly(1, 2, 3, 4);
        assertThat(afterElimination.players())
                .extracting(GameState.Player::accountId)
                .containsExactly("account-1", "account-2", "account-3", "account-4");
        assertThat(afterElimination.players().get(1).health()).isZero();
        assertThat(before).isEqualTo(table(1, 4));
    }

    @Test
    void twoSurvivorsCanReachEachOtherAtBaseRange() {
        GameState before = table(0, 0);

        ShotOutcome outcome = rulesFor(before).fire(before, 1, bang.id(), 3, 0);

        assertThat(outcome.discarded()).containsExactly(bang);
        assertThat(outcome.state().players().getFirst().hand()).isEmpty();
        assertThat(before).isEqualTo(table(0, 0));
    }

    @ParameterizedTest
    @CsvSource({"1, Cible invalide", "2, Cible invalide", "9, Siège inconnu : 9"})
    void invalidTargetsRemainRefusedWithTheRealDistance(int targetSeat, String message) {
        GameState before = table(0, 4);

        assertThatThrownBy(() -> rulesFor(before).fire(before, 1, bang.id(), targetSeat, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(message);

        assertThat(before).isEqualTo(table(0, 4));
        assertThat(before.players().getFirst().hand()).containsExactly(bang);
    }

    private static ShotRules rulesFor(GameState state) {
        return new ShotRules((from, to) -> PlayerDistance.between(state, from, to));
    }

    private GameState table() {
        return table(4, 4);
    }

    private GameState table(int secondHealth, int fourthHealth) {
        return new GameState(
                List.of(player(1, 4, bang), player(2, secondHealth), player(3, 4), player(4, fourthHealth)),
                List.of(),
                List.of(),
                1,
                GameState.Phase.PLAY);
    }

    private static GameState.Player player(int seat, int health, CardInstance... hand) {
        return new GameState.Player(
                "account-" + seat,
                seat,
                new RoleCard(Role.OUTLAW, false),
                BangCharacter.BART_CASSIDY,
                health,
                4,
                List.of(hand));
    }
}
