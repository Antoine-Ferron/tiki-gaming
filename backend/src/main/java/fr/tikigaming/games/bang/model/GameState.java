package fr.tikigaming.games.bang.model;

import fr.tikigaming.games.bang.engine.GameCatalog.CharacterCard;
import java.util.List;

/** État privé du serveur, jamais retourné par le contrôleur HTTP. */
public record GameState(List<Player> players, List<String> drawPile, int currentSeat) {
    public record Player(
            String accountId,
            int seat,
            String role,
            CharacterCard character,
            int health,
            int maxHealth,
            List<String> hand) {}
}
