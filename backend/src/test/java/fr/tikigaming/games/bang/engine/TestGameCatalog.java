package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.StartingCharacter;
import java.util.List;
import java.util.stream.IntStream;

/** Catalogue factice réservé aux tests ; aucune de ces données n'est embarquée en production. */
class TestGameCatalog implements GameCatalog {
    @Override
    public Roles roles() {
        return new Roles("Shérif", "Hors-la-loi", "Renégat");
    }

    @Override
    public List<StartingCharacter> characters() {
        return List.of(
                new StartingCharacter("Paul Regret", 3),
                new StartingCharacter("Bart Cassidy", 4),
                new StartingCharacter("Calamity Janet", 4),
                new StartingCharacter("Willy le Kid", 4));
    }

    @Override
    public List<String> cards() {
        return IntStream.rangeClosed(1, 40)
                .mapToObj(index -> "test-card-" + index)
                .toList();
    }
}
