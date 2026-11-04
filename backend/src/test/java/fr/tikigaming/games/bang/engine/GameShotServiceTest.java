package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.cards.RoleCard;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.List;
import org.junit.jupiter.api.Test;

class GameShotServiceTest {
    private final InitialDeal deal = mock(InitialDeal.class);
    private final PrivateTableService tables = new PrivateTableService(deal);
    private final CardInstance bang = new CardInstance("bang", CardType.BANG);
    private final CardInstance missed = new CardInstance("missed", CardType.MISSED);
    private final CardInstance old = new CardInstance("old", CardType.MISSED);

    @Test
    void firingAppliesTheRulesStateAndAppendsItsDiscardedCards() {
        GameState before = new GameState(
                List.of(
                        player("one", 1, bang), player("two", 2, missed),
                        player("three", 3), player("four", 4)),
                List.of(missed),
                List.of(old),
                1,
                GameState.Phase.PLAY);
        List<String> accounts = List.of("one", "two", "three", "four");
        String code = tables.create("one").code();
        accounts.subList(1, 4).forEach(account -> tables.join(code, account));
        when(deal.deal(accounts)).thenReturn(before);
        tables.start(code, "one");

        tables.fire(code, "one", "bang", 2);

        GameState after = tables.game(code);
        assertThat(after.players().getFirst().hand()).isEmpty();
        assertThat(after.discardPile()).containsExactly(old, bang);
        assertThat(after.drawPile()).isEqualTo(before.drawPile());
        assertThat(after.players().subList(1, 4)).isEqualTo(before.players().subList(1, 4));
    }

    private static GameState.Player player(String account, int seat, CardInstance... hand) {
        return new GameState.Player(
                account, seat, new RoleCard(Role.OUTLAW, false), BangCharacter.CALAMITY_JANET, 4, 4, List.of(hand));
    }
}
