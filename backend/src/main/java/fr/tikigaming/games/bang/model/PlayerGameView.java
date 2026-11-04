package fr.tikigaming.games.bang.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.cards.Role;
import java.util.List;

/** Seules les informations auxquelles le compte connecté a droit. */
public record PlayerGameView(String code, int seat, int currentSeat, Role role, List<Card> hand, List<Player> players) {
    public record Card(String id, CardType type) {}

    public record Player(
            int seat,
            BangCharacter character,
            int health,
            int maxHealth,
            List<Card> playedCards,
            int handCount,
            @JsonInclude(JsonInclude.Include.NON_NULL) Role role) {}
}
