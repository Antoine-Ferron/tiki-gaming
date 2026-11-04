package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.assertRejected;
import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.game;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static fr.tikigaming.games.dame.DameTestSupport.pos;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class InvalidMoveTest {

    @ParameterizedTest
    @CsvSource({"6, 3", "6, 4", "5, 3", "7, 2", "7, 4", "4, 1", "3, 0", "5, 1"})
    void rejectsZeroOrthogonalBackwardAndOversizedMovesWithoutChangingState(int row, int column) {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)), at(1, 0, man(Player.BLACK)));

        assertRejected(game, move(6, 3, row, column));
    }

    @Test
    void rejectsAnEmptyOrigin() {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)), at(1, 0, man(Player.BLACK)));

        assertRejected(game, move(6, 1, 5, 0));
    }

    @ParameterizedTest
    @CsvSource({"2, 3", "2, 5"})
    void alsoRejectsOrdinaryBackwardMovesForBlack(int row, int column) {
        Game game = game(Player.BLACK, at(3, 4, man(Player.BLACK)), at(8, 9, man(Player.WHITE)));

        assertRejected(game, move(3, 4, row, column));
    }

    @Test
    void rejectsADestinationOccupiedByAnAlly() {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)), at(5, 4, man(Player.WHITE)));

        assertRejected(game, move(6, 3, 5, 4));
    }

    @Test
    void rejectsLandingDirectlyOnAnOpponent() {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)), at(5, 4, man(Player.BLACK)));

        assertRejected(game, move(6, 3, 5, 4));
    }

    @Test
    void rejectsJumpingOverAnAlly() {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)), at(5, 4, man(Player.WHITE)));

        assertRejected(game, move(6, 3, 4, 5));
    }

    @Test
    void rejectsSeveralOrdinaryMovesInOneTurn() {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)), at(1, 0, man(Player.BLACK)));

        assertRejected(game, move(6, 3, 5, 2, 4, 1));
    }

    @Test
    void rejectsAnEmptyRoute() {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)));

        assertRejected(game, new Move(pos(6, 3), List.of()));
    }

    @Test
    void rejectsANullCommand() {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)));

        assertRejected(game, null);
    }

    @Test
    void rejectsANullOrigin() {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)));

        assertRejected(game, new Move(null, List.of(pos(5, 2))));
    }

    @ParameterizedTest
    @CsvSource({"-1, 0", "10, 1", "5, -1", "5, 10"})
    void rejectsAnOutOfBoundsDestinationWithoutChangingState(int row, int column) {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)));
        Map<Position, Piece> previous = game.board().pieces();

        assertThatThrownBy(() -> game.play(move(6, 3, row, column))).isInstanceOf(IllegalArgumentException.class);

        assertThat(game.board().pieces()).isEqualTo(previous);
        assertThat(game.currentPlayer()).isEqualTo(Player.WHITE);
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
    }

    @ParameterizedTest
    @CsvSource({"-1, 0", "10, 1", "5, -1", "5, 10"})
    void rejectsAnOutOfBoundsOriginWithoutChangingState(int row, int column) {
        Game game = game(Player.WHITE, at(6, 3, man(Player.WHITE)));
        Map<Position, Piece> previous = game.board().pieces();

        assertThatThrownBy(() -> game.play(move(row, column, 5, 2))).isInstanceOf(IllegalArgumentException.class);

        assertThat(game.board().pieces()).isEqualTo(previous);
        assertThat(game.currentPlayer()).isEqualTo(Player.WHITE);
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
    }
}
