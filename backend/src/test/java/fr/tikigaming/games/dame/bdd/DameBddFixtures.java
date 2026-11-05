package fr.tikigaming.games.dame.bdd;

import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import java.util.List;
import java.util.Map;

/** Positions littérales ; aucune règle de déplacement ou de victoire n'est simulée. */
final class DameBddFixtures {

    private DameBddFixtures() {}

    static Game beforeLastCapture(Player camp) {
        return new Game(
                new Board(Map.of(
                        new Position(6, 1), new Piece(Player.WHITE, false),
                        new Position(5, 2), new Piece(Player.BLACK, false))),
                camp);
    }

    static Move lastCapture(Player camp) {
        return camp == Player.WHITE
                ? new Move(new Position(6, 1), List.of(new Position(4, 3)))
                : new Move(new Position(5, 2), List.of(new Position(7, 0)));
    }
}
