package fr.tikigaming.games.bang.engine;

import fr.tikigaming.games.bang.model.GameState;

public final class PlayerDistance {
    private PlayerDistance() {}

    public static int between(GameState state, int fromSeat, int toSeat) {
        return Math.abs(fromSeat - toSeat);
    }
}
