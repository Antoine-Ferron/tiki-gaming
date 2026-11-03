package fr.tikigaming.games.dame;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

/** Construction de positions explicites et assertions d'atomicité, uniquement pour les tests. */
final class DameTestSupport {

    private DameTestSupport() {}

    record Placement(Position position, Piece piece) {}

    static Position pos(int row, int column) {
        return new Position(row, column);
    }

    static Piece man(Player player) {
        return new Piece(player, false);
    }

    static Piece king(Player player) {
        return new Piece(player, true);
    }

    static Placement at(int row, int column, Piece piece) {
        return new Placement(pos(row, column), piece);
    }

    static Board board(Placement... placements) {
        Map<Position, Piece> pieces = new LinkedHashMap<>();
        for (Placement placement : placements) {
            if (pieces.put(placement.position(), placement.piece()) != null) {
                throw new IllegalArgumentException("Fixture avec deux pièces sur " + placement.position());
            }
        }
        return new Board(pieces);
    }

    static Game game(Player currentPlayer, Placement... placements) {
        return new Game(board(placements), currentPlayer);
    }

    static Move move(int fromRow, int fromColumn, int... landingCoordinates) {
        if (landingCoordinates.length == 0 || landingCoordinates.length % 2 != 0) {
            throw new IllegalArgumentException("Une fixture de coup exige des paires ligne/colonne.");
        }
        var landings = new ArrayList<Position>();
        for (int index = 0; index < landingCoordinates.length; index += 2) {
            landings.add(pos(landingCoordinates[index], landingCoordinates[index + 1]));
        }
        return new Move(pos(fromRow, fromColumn), landings);
    }

    static void assertAccepted(Game game, Move move) {
        assertThatCode(() -> game.play(move)).doesNotThrowAnyException();
    }

    static void assertRejected(Game game, Move move) {
        Map<Position, Piece> previousPieces = Map.copyOf(game.board().pieces());
        Player previousPlayer = game.currentPlayer();
        GameStatus previousStatus = game.status();

        assertThatThrownBy(() -> game.play(move)).isInstanceOf(IllegalArgumentException.class);

        assertThat(game.board().pieces()).as("plateau inchangé après refus").isEqualTo(previousPieces);
        assertThat(game.currentPlayer()).as("tour inchangé après refus").isEqualTo(previousPlayer);
        assertThat(game.status()).as("statut inchangé après refus").isEqualTo(previousStatus);
    }

    static Map<Position, Piece> expectedInitialPieces() {
        return board(
                        at(0, 1, man(Player.BLACK)),
                        at(0, 3, man(Player.BLACK)),
                        at(0, 5, man(Player.BLACK)),
                        at(0, 7, man(Player.BLACK)),
                        at(0, 9, man(Player.BLACK)),
                        at(1, 0, man(Player.BLACK)),
                        at(1, 2, man(Player.BLACK)),
                        at(1, 4, man(Player.BLACK)),
                        at(1, 6, man(Player.BLACK)),
                        at(1, 8, man(Player.BLACK)),
                        at(2, 1, man(Player.BLACK)),
                        at(2, 3, man(Player.BLACK)),
                        at(2, 5, man(Player.BLACK)),
                        at(2, 7, man(Player.BLACK)),
                        at(2, 9, man(Player.BLACK)),
                        at(3, 0, man(Player.BLACK)),
                        at(3, 2, man(Player.BLACK)),
                        at(3, 4, man(Player.BLACK)),
                        at(3, 6, man(Player.BLACK)),
                        at(3, 8, man(Player.BLACK)),
                        at(6, 1, man(Player.WHITE)),
                        at(6, 3, man(Player.WHITE)),
                        at(6, 5, man(Player.WHITE)),
                        at(6, 7, man(Player.WHITE)),
                        at(6, 9, man(Player.WHITE)),
                        at(7, 0, man(Player.WHITE)),
                        at(7, 2, man(Player.WHITE)),
                        at(7, 4, man(Player.WHITE)),
                        at(7, 6, man(Player.WHITE)),
                        at(7, 8, man(Player.WHITE)),
                        at(8, 1, man(Player.WHITE)),
                        at(8, 3, man(Player.WHITE)),
                        at(8, 5, man(Player.WHITE)),
                        at(8, 7, man(Player.WHITE)),
                        at(8, 9, man(Player.WHITE)),
                        at(9, 0, man(Player.WHITE)),
                        at(9, 2, man(Player.WHITE)),
                        at(9, 4, man(Player.WHITE)),
                        at(9, 6, man(Player.WHITE)),
                        at(9, 8, man(Player.WHITE)))
                .pieces();
    }
}
