package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.GameState;
import java.util.List;

public final class PlayerDistance {
    private PlayerDistance() {}

    public static int between(GameState state, int fromSeat, int toSeat) {
        List<Integer> livingSeats = state.players().stream()
                .filter(player -> player.health() > 0)
                .map(GameState.Player::seat)
                .toList();
        int gap = Math.abs(livingSeats.indexOf(fromSeat) - livingSeats.indexOf(toSeat));
        return Math.min(gap, livingSeats.size() - gap);
    }
}
