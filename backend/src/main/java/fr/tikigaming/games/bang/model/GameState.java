package fr.tikigaming.games.bang.model;

import java.util.List;

/** État privé du serveur, jamais retourné par le contrôleur HTTP. */
public record GameState(List<Player> players, List<String> drawPile, int currentSeat) {
    public record Player(
            String accountId,
            int seat,
            String role,
            StartingCharacter character,
            int health,
            int maxHealth,
            List<String> hand) {}
}
