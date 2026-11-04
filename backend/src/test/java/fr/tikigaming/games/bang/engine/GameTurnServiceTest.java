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

    @Test
    void drawingMovesTheFirstTwoCardsIntoTheActiveHand() throws Exception {
        String code = startedTable();

        tables.draw(code, "one");

        GameState result = tables.game(code);
        assertThat(result.players().getFirst().hand()).containsExactly(first, second);
        assertThat(result.drawPile()).containsExactly(third);
        assertThat(result.phase()).isEqualTo(GameState.Phase.PLAY);
    }

    private String startedTable() {
        String code = tables.create("one").code();
        List.of("two", "three", "four").forEach(account -> tables.join(code, account));
        var sheriff = new GameState.Player(
                "one", 1, new RoleCard(Role.SHERIFF, true), BangCharacter.BART_CASSIDY, 5, 5, List.of());
        when(deal.deal(anyList()))
                .thenReturn(new GameState(List.of(sheriff), List.of(first, second, third), 1, GameState.Phase.DRAW));
        tables.start(code, "one");
        return code;
    }
}
