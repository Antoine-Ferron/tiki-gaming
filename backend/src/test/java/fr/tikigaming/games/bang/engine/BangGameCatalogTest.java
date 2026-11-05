package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.model.CardInstance;
import org.junit.jupiter.api.Test;

class BangGameCatalogTest {
    @Test
    void providesThePublishedCountsOfImplementedCardsWithUniqueStableIds() {
        GameCatalog catalog = new BangGameCatalog();
        var cards = catalog.cards();

        assertThat(cards).hasSize(37);
        assertThat(cards).filteredOn(card -> card.type() == CardType.BANG).hasSize(25);
        assertThat(cards).filteredOn(card -> card.type() == CardType.MISSED).hasSize(12);
        assertThat(cards)
                .extracting(CardInstance::id)
                .doesNotHaveDuplicates()
                .allSatisfy(id -> assertThat(id).isNotBlank());
        assertThat(catalog.cards()).isEqualTo(cards);
        assertThatThrownBy(cards::clear).isInstanceOf(UnsupportedOperationException.class);
    }
}
