package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.GameState;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class InitialDeal {
    private final Optional<GameCatalog> catalog;
    private final Consumer<List<?>> shuffle;

    @Autowired
    public InitialDeal(Optional<GameCatalog> catalog) {
        this(catalog, Collections::shuffle);
    }

    InitialDeal(Optional<GameCatalog> catalog, Consumer<List<?>> shuffle) {
        this.catalog = catalog;
        this.shuffle = shuffle;
    }

    public GameState deal(List<String> accounts) {
        GameCatalog source = catalog.orElseThrow(() -> new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE, "Les cartes de mise en place ne sont pas encore disponibles."));
        GameCatalog.Roles roles = source.roles();
        List<String> assignedRoles =
                new ArrayList<>(List.of(roles.sheriff(), roles.outlaw(), roles.outlaw(), roles.renegade()));
        List<GameCatalog.CharacterCard> characters = new ArrayList<>(source.characters());
        List<String> deck = new ArrayList<>(source.cards());
        shuffle.accept(assignedRoles);
        shuffle.accept(characters);
        shuffle.accept(deck);
        List<GameState.Player> players = new ArrayList<>();
        int drawn = 0;
        for (int seat = 0; seat < 4; seat++) {
            int health =
                    characters.get(seat).health() + (assignedRoles.get(seat).equals(roles.sheriff()) ? 1 : 0);
            List<String> hand = List.copyOf(deck.subList(drawn, drawn + health));
            drawn += health;
            players.add(new GameState.Player(
                    accounts.get(seat), seat + 1, assignedRoles.get(seat), characters.get(seat), health, health, hand));
        }
        return new GameState(
                List.copyOf(players),
                List.copyOf(deck.subList(drawn, deck.size())),
                assignedRoles.indexOf(roles.sheriff()) + 1);
    }
}
