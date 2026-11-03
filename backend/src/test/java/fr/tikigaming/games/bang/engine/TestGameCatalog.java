package fr.tikigaming.games.bang.engine;

import java.util.List;
import java.util.stream.IntStream;

/** Catalogue factice réservé aux tests ; aucune de ces données n'est embarquée en production. */
class TestGameCatalog implements GameCatalog {
    @Override
    public Roles roles() {
        return new Roles("Shérif", "Hors-la-loi", "Renégat");
    }

    @Override
    public List<CharacterCard> characters() {
        return List.of(
                new CharacterCard("Paul Regret", 3),
                new CharacterCard("Bart Cassidy", 4),
                new CharacterCard("Calamity Janet", 4),
                new CharacterCard("Willy le Kid", 4));
    }

    @Override
    public List<String> cards() {
        return IntStream.rangeClosed(1, 40)
                .mapToObj(index -> "test-card-" + index)
                .toList();
    }
}
