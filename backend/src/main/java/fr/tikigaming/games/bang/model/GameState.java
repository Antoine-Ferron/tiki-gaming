package fr.tikigaming.games.bang.model;

import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.RoleCard;
import java.util.List;

/** État privé du serveur, jamais retourné par le contrôleur HTTP. */
public record GameState(List<Player> players, List<CardInstance> drawPile, int currentSeat, Phase phase) {
    public enum Phase {
        DRAW,
        PLAY,
        DISCARD
    }

    public record Player(
            String accountId,
            int seat,
            RoleCard roleCard,
            BangCharacter character,
            int health,
            int maxHealth,
            List<CardInstance> hand) {}
}
