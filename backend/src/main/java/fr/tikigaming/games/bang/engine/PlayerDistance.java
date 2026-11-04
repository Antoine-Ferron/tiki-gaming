package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.GameState;

public final class PlayerDistance {
    private PlayerDistance() {}

    public static int between(GameState state, int fromSeat, int toSeat) {
        int gap = Math.abs(fromSeat - toSeat);
        return Math.min(gap, state.players().size() - gap);
    }
}
