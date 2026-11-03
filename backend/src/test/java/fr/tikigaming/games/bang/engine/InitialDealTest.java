package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.bang.model.GameState;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

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

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4})
    void onlyTheSheriffGetsOneExtraCurrentAndMaximumHealthPoint(int sheriffSeat) {
        InitialDeal controlled = new InitialDeal(Optional.of(catalog), list -> {
            if (!list.equals(catalog.characters())) Collections.rotate(list, sheriffSeat - 1);
        });

        GameState game = controlled.deal(List.of("creator", "second", "third", "fourth"));

        for (GameState.Player player : game.players()) {
            int expected = player.character().health() + (player.seat() == sheriffSeat ? 1 : 0);
            assertThat(player.health())
                    .as("PV courants de la place %s", player.seat())
                    .isEqualTo(expected);
            assertThat(player.maxHealth())
                    .as("PV maximum de la place %s", player.seat())
                    .isEqualTo(expected);
        }
    }
}
