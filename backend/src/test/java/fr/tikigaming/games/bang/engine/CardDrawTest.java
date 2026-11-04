package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.cards.RoleCard;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CardDrawTest {
    private final CardInstance held = new CardInstance("held", CardType.MISSED);
    private final CardInstance first = new CardInstance("first", CardType.BANG);
    private final CardInstance second = new CardInstance("second", CardType.MISSED);
    private final CardInstance third = new CardInstance("third", CardType.BANG);
    private final List<List<CardInstance>> shuffled = new ArrayList<>();
    private final CardDraw draw = new CardDraw(cards -> {
        shuffled.add(List.copyOf(cards));
        Collections.reverse(cards);
    });

    @Test
    void anEmptyPileDrawsFromTheShuffledDiscardWithoutChangingTheInput() {
        GameState before = game(List.of(), List.of(first, second, third));

        GameState after = draw.draw(before, 2, 1);

        assertThat(after.players().get(1).hand()).containsExactly(held, third);
        assertThat(after.players().get(1).hand().getLast()).isSameAs(third);
        assertThat(after.drawPile()).containsExactly(second, first);
        assertThat(after.discardPile()).isEmpty();
        assertThat(shuffled).containsExactly(List.of(first, second, third));
        assertThat(before.drawPile()).isEmpty();
        assertThat(before.discardPile()).containsExactly(first, second, third);
        assertThat(before.players().get(1).hand()).containsExactly(held);
        assertThat(after.players().getFirst()).isSameAs(before.players().getFirst());
        assertThat(after.currentSeat()).isEqualTo(before.currentSeat());
        assertThat(after.phase()).isEqualTo(before.phase());
    }

    @Test
    void twoCardsCanSpanTheOldPileAndTheShuffledDiscard() {
        GameState before = game(List.of(first), List.of(second, third));

        GameState after = draw.draw(before, 2, 2);

        assertThat(after.players().get(1).hand()).containsExactly(held, first, third);
        assertThat(after.drawPile()).containsExactly(second);
        assertThat(after.discardPile()).isEmpty();
        assertThat(shuffled).containsExactly(List.of(second, third));
        assertThat(before.drawPile()).containsExactly(first);
        assertThat(before.discardPile()).containsExactly(second, third);
    }

    @Test
    void drawingTheLastAvailableCardDoesNotShuffleAnUnusedDiscard() {
        GameState before = game(List.of(first), List.of(second, third));

        GameState after = draw.draw(before, 2, 1);

        assertThat(after.players().get(1).hand()).containsExactly(held, first);
        assertThat(after.drawPile()).isEmpty();
        assertThat(after.discardPile()).containsExactly(second, third);
        assertThat(shuffled).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({"0,0", "0,1", "1,0"})
    void insufficientCardsAreRefusedBeforeAnyShuffleOrTransfer(int deckSize, int discardSize) {
        GameState before =
                game(List.of(first).subList(0, deckSize), List.of(second).subList(0, discardSize));

        assertThatThrownBy(() -> draw.draw(before, 2, 2)).isInstanceOf(IllegalStateException.class);

        assertThat(before.players().get(1).hand()).containsExactly(held);
        assertThat(before.drawPile()).hasSize(deckSize);
        assertThat(before.discardPile()).hasSize(discardSize);
        assertThat(shuffled).isEmpty();
    }

    private GameState game(List<CardInstance> deck, List<CardInstance> discard) {
        return new GameState(
                List.of(
                        new GameState.Player(
                                "one",
                                1,
                                new RoleCard(Role.SHERIFF, true),
                                BangCharacter.CALAMITY_JANET,
                                5,
                                5,
                                List.of()),
                        new GameState.Player(
                                "two",
                                2,
                                new RoleCard(Role.OUTLAW, false),
                                BangCharacter.BART_CASSIDY,
                                3,
                                4,
                                List.of(held))),
                deck,
                discard,
                1,
                GameState.Phase.PLAY);
    }
}
