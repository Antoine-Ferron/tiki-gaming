package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.model.CardInstance;
import java.util.List;
import java.util.stream.IntStream;

/** Composition fictive de 40 cartes réservée aux tests ; aucune quantité de production n'est définie ici. */
class TestGameCatalog implements GameCatalog {
    @Override
    public List<CardInstance> cards() {
        return IntStream.rangeClosed(1, 40)
                .mapToObj(index ->
                        new CardInstance("test-card-" + index, index % 2 == 0 ? CardType.MISSED : CardType.BANG))
                .toList();
    }
}
