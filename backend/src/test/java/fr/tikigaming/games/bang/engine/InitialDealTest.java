package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class InitialDealTest {
    private final TestGameCatalog catalog = new TestGameCatalog();
    private final InitialDeal deal = new InitialDeal(Optional.of(catalog), list -> {
        if (!(list.getFirst() instanceof BangCharacter)) Collections.rotate(list, 2);
    });

    @Test
    void dealsTheFourRolesAndDistinctCharactersUsingTheDistributionOrder() {
        GameState game = deal.deal(List.of("creator", "second", "third", "fourth"));

        assertThat(game.players())
                .extracting(GameState.Player::accountId)
                .containsExactly("creator", "second", "third", "fourth");
        assertThat(game.players()).extracting(GameState.Player::seat).containsExactly(1, 2, 3, 4);
        assertThat(game.players())
                .extracting(player -> player.roleCard().role())
                .containsExactly(Role.OUTLAW, Role.RENEGADE, Role.SHERIFF, Role.OUTLAW);
        assertThat(game.players())
                .extracting(GameState.Player::character)
                .containsExactlyInAnyOrder(BangCharacter.values())
                .doesNotHaveDuplicates();
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4})
    void onlyTheSheriffGetsOneExtraCurrentAndMaximumHealthPoint(int sheriffSeat) {
        InitialDeal controlled = new InitialDeal(Optional.of(catalog), list -> {
            if (!(list.getFirst() instanceof BangCharacter)) Collections.rotate(list, sheriffSeat - 1);
        });

        GameState game = controlled.deal(List.of("creator", "second", "third", "fourth"));

        for (GameState.Player player : game.players()) {
            int expected = player.character().lifePoints() + (player.seat() == sheriffSeat ? 1 : 0);
            assertThat(player.health())
                    .as("PV courants de la place %s", player.seat())
                    .isEqualTo(expected);
            assertThat(player.maxHealth())
                    .as("PV maximum de la place %s", player.seat())
                    .isEqualTo(expected);
        }
    }

    @Test
    void handsAndRemainingDrawPilePartitionTheShuffledPhysicalDeck() {
        GameState game = deal.deal(List.of("creator", "second", "third", "fourth"));

        List<CardInstance> allCards = new ArrayList<>();
        for (GameState.Player player : game.players()) {
            assertThat(player.hand()).hasSize(player.health());
            allCards.addAll(player.hand());
        }
        List<CardInstance> expectedOrder = new ArrayList<>(catalog.cards());
        Collections.rotate(expectedOrder, 2);
        assertThat(allCards).containsExactlyElementsOf(expectedOrder.subList(0, 16));
        assertThat(game.drawPile()).containsExactlyElementsOf(expectedOrder.subList(16, 40));
        allCards.addAll(game.drawPile());
        assertThat(allCards).extracting(CardInstance::id).doesNotHaveDuplicates();
        assertThat(allCards).containsExactlyInAnyOrderElementsOf(catalog.cards());
        assertThat(catalog.cards().getFirst().id()).isEqualTo("test-card-1");
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4})
    void theFirstTurnBelongsToTheSheriffWhateverTheirSeat(int sheriffSeat) {
        InitialDeal controlled =
                new InitialDeal(Optional.of(catalog), list -> Collections.rotate(list, sheriffSeat - 1));

        GameState game = controlled.deal(List.of("creator", "second", "third", "fourth"));

        assertThat(game.currentSeat()).isEqualTo(sheriffSeat);
        assertThat(game.players().get(sheriffSeat - 1).roleCard().role()).isEqualTo(Role.SHERIFF);
    }
}
