package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.cards.RoleCard;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class InitialDeal {
    private final GameCatalog catalog;
    private final Consumer<List<?>> shuffle;

    @Autowired
    public InitialDeal(GameCatalog catalog) {
        this(catalog, Collections::shuffle);
    }

    InitialDeal(GameCatalog catalog, Consumer<List<?>> shuffle) {
        this.catalog = catalog;
        this.shuffle = shuffle;
    }

    public GameState deal(List<String> accounts) {
        List<Role> assignedRoles = new ArrayList<>(List.of(Role.SHERIFF, Role.OUTLAW, Role.OUTLAW, Role.RENEGADE));
        List<BangCharacter> characters = new ArrayList<>(List.of(BangCharacter.values()));
        List<CardInstance> deck = new ArrayList<>(catalog.cards());
        shuffle.accept(assignedRoles);
        shuffle.accept(characters);
        shuffle.accept(deck);
        List<GameState.Player> players = new ArrayList<>();
        int drawn = 0;
        for (int seat = 0; seat < 4; seat++) {
            Role role = assignedRoles.get(seat);
            int health = characters.get(seat).lifePoints() + (role == Role.SHERIFF ? 1 : 0);
            List<CardInstance> hand = List.copyOf(deck.subList(drawn, drawn + health));
            drawn += health;
            players.add(new GameState.Player(
                    accounts.get(seat),
                    seat + 1,
                    new RoleCard(role, role == Role.SHERIFF),
                    characters.get(seat),
                    health,
                    health,
                    hand));
        }
        return new GameState(
                List.copyOf(players),
                List.copyOf(deck.subList(drawn, deck.size())),
                List.of(),
                assignedRoles.indexOf(Role.SHERIFF) + 1,
                GameState.Phase.DRAW);
    }
}
