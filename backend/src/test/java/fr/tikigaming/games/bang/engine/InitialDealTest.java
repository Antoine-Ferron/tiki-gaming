package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.bang.model.GameState;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class InitialDealTest {
    private final TestGameCatalog catalog = new TestGameCatalog();
    private final InitialDeal deal = new InitialDeal(Optional.of(catalog), list -> Collections.rotate(list, 2));

    @Test
    void dealsTheFourRolesAndDistinctCharactersUsingTheDistributionOrder() {
        GameState game = deal.deal(List.of("creator", "second", "third", "fourth"));

        assertThat(game.players())
                .extracting(GameState.Player::accountId)
                .containsExactly("creator", "second", "third", "fourth");
        assertThat(game.players()).extracting(GameState.Player::seat).containsExactly(1, 2, 3, 4);
        assertThat(game.players())
                .extracting(GameState.Player::role)
                .containsExactly("Hors-la-loi", "Renégat", "Shérif", "Hors-la-loi");
        assertThat(game.players())
                .extracting(GameState.Player::character)
                .containsExactlyInAnyOrderElementsOf(catalog.characters())
                .doesNotHaveDuplicates();
    }
}
