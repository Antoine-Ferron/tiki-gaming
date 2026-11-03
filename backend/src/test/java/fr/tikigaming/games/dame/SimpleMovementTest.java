package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.assertAccepted;
import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.board;
import static fr.tikigaming.games.dame.DameTestSupport.game;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static fr.tikigaming.games.dame.DameTestSupport.pos;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SimpleMovementTest {

    @ParameterizedTest
    @CsvSource({"WHITE, 6, 3, 5, 2", "WHITE, 6, 3, 5, 4", "BLACK, 3, 4, 4, 3", "BLACK, 3, 4, 4, 5"})
    void movesAManOneSquareForwardAndPreservesAllPieces(
            Player player, int fromRow, int fromColumn, int toRow, int toColumn) {
        Player opponent = player == Player.WHITE ? Player.BLACK : Player.WHITE;
        int opponentRow = player == Player.WHITE ? 1 : 8;
        int opponentColumn = player == Player.WHITE ? 0 : 9;
        Game game = game(player, at(fromRow, fromColumn, man(player)), at(opponentRow, opponentColumn, man(opponent)));

        assertAccepted(game, move(fromRow, fromColumn, toRow, toColumn));

        assertThat(game.board().pieces())
                .hasSize(2)
                .doesNotContainKey(pos(fromRow, fromColumn))
                .containsEntry(pos(toRow, toColumn), man(player))
                .containsEntry(pos(opponentRow, opponentColumn), man(opponent));
        assertThat(game.currentPlayer()).isEqualTo(opponent);
    }

    @Test
    void proposesExactlyTheTwoWhiteForwardDiagonalsWhenNoCaptureExists() {
        Board board = board(at(6, 3, man(Player.WHITE)), at(1, 0, man(Player.BLACK)));

        assertThat(new GameRules().legalMoves(board, Player.WHITE))
                .containsExactlyInAnyOrder(move(6, 3, 5, 2), move(6, 3, 5, 4));
    }

    @Test
    void proposesExactlyTheTwoBlackForwardDiagonalsWhenNoCaptureExists() {
        Board board = board(at(3, 4, man(Player.BLACK)), at(8, 9, man(Player.WHITE)));

        assertThat(new GameRules().legalMoves(board, Player.BLACK))
                .containsExactlyInAnyOrder(move(3, 4, 4, 3), move(3, 4, 4, 5));
    }

    @ParameterizedTest
    @CsvSource({"WHITE, 5, 0, 4, 1", "BLACK, 4, 9, 5, 8"})
    void offersOnlyTheDiagonalInsideTheBoardAtAnEdge(
            Player player, int fromRow, int fromColumn, int toRow, int toColumn) {
        Board board = board(at(fromRow, fromColumn, man(player)));

        assertThat(new GameRules().legalMoves(board, player))
                .containsExactly(move(fromRow, fromColumn, toRow, toColumn));
    }
}
