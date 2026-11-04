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

    private static ShotRules rulesFor(GameState state) {
        return new ShotRules((from, to) -> PlayerDistance.between(state, from, to));
    }

    private GameState table() {
        return new GameState(
                List.of(player(1, 4, bang), player(2, 4), player(3, 4), player(4, 4)),
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
