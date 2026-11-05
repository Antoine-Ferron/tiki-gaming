package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
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

class GameTurnServiceTest {
    private final InitialDeal deal = mock(InitialDeal.class);
    private final PrivateTableService tables = new PrivateTableService(deal);
    private final CardInstance first = new CardInstance("first", CardType.BANG);
    private final CardInstance second = new CardInstance("second", CardType.MISSED);
    private final CardInstance third = new CardInstance("third", CardType.BANG);
    private final CardInstance discarded = new CardInstance("discarded", CardType.MISSED);

    @Test
    void drawingMovesTheFirstTwoCardsIntoTheActiveHand() throws Exception {
        String code = startedTable();

        tables.draw(code, "one");

        GameState result = tables.game(code);
        assertThat(result.players().getFirst().hand()).containsExactly(first, second);
        assertThat(result.drawPile()).containsExactly(third);
        assertThat(result.phase()).isEqualTo(GameState.Phase.PLAY);
        assertThat(result.discardPile()).containsExactly(discarded);
    }

    @Test
    void endingPlayAboveCurrentHealthEntersDiscard() throws Exception {
        String code = startedTable(1);
        tables.draw(code, "one");

        tables.endTurn(code, "one");

        assertThat(tables.game(code).phase()).isEqualTo(GameState.Phase.DISCARD);
        assertThat(tables.game(code).currentSeat()).isEqualTo(1);
        assertThat(tables.game(code).discardPile()).containsExactly(discarded);
    }

    @Test
    void discardingMovesTheChosenCardFromTheHandToTheDiscardPile() throws Exception {
        String code = startedTable(1);
        tables.draw(code, "one");
        tables.endTurn(code, "one");

        tables.discard(code, "one", "second");

        GameState result = tables.game(code);
        assertThat(result.players().getFirst().hand()).containsExactly(first);
        assertThat(result.discardPile()).containsExactly(discarded, second);
        assertThat(result.drawPile()).containsExactly(third);
    }

    private String startedTable() {
        return startedTable(5);
    }

    private String startedTable(int health) {
        String code = tables.create("one").code();
        List.of("two", "three", "four").forEach(account -> tables.join(code, account));
        var sheriff = new GameState.Player(
                "one", 1, new RoleCard(Role.SHERIFF, true), BangCharacter.BART_CASSIDY, health, 5, List.of());
        when(deal.deal(anyList()))
                .thenReturn(new GameState(
                        List.of(sheriff), List.of(first, second, third), List.of(discarded), 1, GameState.Phase.DRAW));
        tables.start(code, "one");
        return code;
    }
}
