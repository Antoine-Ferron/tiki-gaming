package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.model.CardInstance;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Pioche des deux types jouables du prototype.
 *
 * @see <a href="https://bang.dvgiochi.com/list_download.php?id=1">Quantités publiées par l'éditeur</a>
 */
@Component
class BangGameCatalog implements GameCatalog {
    @Override
    public List<CardInstance> cards() {
        // shortcut: seuls BANG! et Raté! sont jouables, compléter à l'ajout des autres types de cartes.
        List<CardInstance> cards = new ArrayList<>();
        for (int copy = 1; copy <= 25; copy++) {
            cards.add(new CardInstance("BANG-" + copy, CardType.BANG));
        }
        for (int copy = 1; copy <= 12; copy++) {
            cards.add(new CardInstance("MISSED-" + copy, CardType.MISSED));
        }
        return List.copyOf(cards);
    }
}
