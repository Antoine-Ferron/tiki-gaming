package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.GameState;
import java.util.List;

public final class PlayerDistance {
    private PlayerDistance() {}

    /**
     * Distance de base dans l'ordre circulaire de {@code state.players()}, sans modifier l'état ni appliquer de pouvoir.
     * Seuls les joueurs dont les PV actuels sont strictement positifs comptent ; leurs sièges restent inchangés.
     *
     * @throws IllegalArgumentException si un des sièges est inconnu ou éliminé
     */
    public static int between(GameState state, int fromSeat, int toSeat) {
        List<Integer> livingSeats = state.players().stream()
                .filter(player -> player.health() > 0)
                .map(GameState.Player::seat)
                .toList();
        int from = livingSeats.indexOf(fromSeat);
        int to = livingSeats.indexOf(toSeat);
        if (from < 0 || to < 0) {
            throw new IllegalArgumentException("La distance nécessite deux joueurs vivants");
        }
        int gap = Math.abs(from - to);
        return Math.min(gap, livingSeats.size() - gap);
    }
}
