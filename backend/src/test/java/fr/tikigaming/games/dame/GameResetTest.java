package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.assertAccepted;
import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.expectedInitialPieces;
import static fr.tikigaming.games.dame.DameTestSupport.game;
import static fr.tikigaming.games.dame.DameTestSupport.king;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static fr.tikigaming.games.dame.DameTestSupport.pos;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("US-12 — Réinitialisation")
class GameResetTest {

    @Test
    void resettingANewGameRestoresTheInitialPosition() {
        Game game = new Game();

        assertThatCode(game::reset).doesNotThrowAnyException();

        assertInitialState(game);
    }

    @Test
    void resettingAfterASimpleMoveRestoresWhiteToMoveAndAllFortyMen() {
        Game game = game(Player.WHITE, at(6, 1, man(Player.WHITE)), at(1, 0, man(Player.BLACK)));
        assertAccepted(game, move(6, 1, 5, 0));

        assertThatCode(game::reset).doesNotThrowAnyException();

        assertInitialState(game);
    }

    @Test
    void resettingAfterACaptureRestoresTheTakenPieceAsPartOfANewGame() {
        Game game = game(
                Player.WHITE, at(6, 1, man(Player.WHITE)), at(5, 2, man(Player.BLACK)), at(1, 0, man(Player.BLACK)));
        assertAccepted(game, move(6, 1, 4, 3));

        assertThatCode(game::reset).doesNotThrowAnyException();

        assertInitialState(game);
    }

    @Test
    void resettingAfterAMultipleCaptureClearsThePreviousSequence() {
        Game game = game(
                Player.WHITE,
                at(6, 1, man(Player.WHITE)),
                at(5, 2, man(Player.BLACK)),
                at(3, 4, man(Player.BLACK)),
                at(1, 8, man(Player.BLACK)));
        assertAccepted(game, move(6, 1, 4, 3, 2, 5));

        assertThatCode(game::reset).doesNotThrowAnyException();

        assertInitialState(game);
        assertAccepted(game, move(6, 1, 5, 0));
        assertThat(game.currentPlayer()).isEqualTo(Player.BLACK);
    }

    @Test
    void resettingAfterPromotionLeavesOnlyMenOnTheNewBoard() {
        Game game = game(Player.WHITE, at(1, 2, man(Player.WHITE)), at(8, 9, man(Player.BLACK)));
        assertAccepted(game, move(1, 2, 0, 1));
        assertThat(game.board().pieceAt(pos(0, 1))).contains(king(Player.WHITE));

        assertThatCode(game::reset).doesNotThrowAnyException();

        assertInitialState(game);
    }

    @Test
    void resettingAfterWhiteWinsRestoresAnInProgressGame() {
        Game game = game(Player.WHITE, at(6, 1, man(Player.WHITE)), at(5, 2, man(Player.BLACK)));
        assertAccepted(game, move(6, 1, 4, 3));
        assertThat(game.status()).isEqualTo(GameStatus.WHITE_WON);

        assertThatCode(game::reset).doesNotThrowAnyException();

        assertInitialState(game);
        assertAccepted(game, move(6, 1, 5, 0));
    }

    @Test
    void resettingAfterBlackWinsAlsoRestoresWhiteToMove() {
        Game game = game(Player.BLACK, at(3, 2, man(Player.BLACK)), at(4, 3, man(Player.WHITE)));
        assertAccepted(game, move(3, 2, 5, 4));
        assertThat(game.status()).isEqualTo(GameStatus.BLACK_WON);

        assertThatCode(game::reset).doesNotThrowAnyException();

        assertInitialState(game);
    }

    @Test
    void resettingTwiceHasTheSameResultAsResettingOnce() {
        Game game = game(Player.BLACK, at(3, 2, man(Player.BLACK)), at(8, 9, king(Player.WHITE)));

        assertThatCode(game::reset).doesNotThrowAnyException();
        Map<Position, Piece> firstReset = Map.copyOf(game.board().pieces());
        assertThatCode(game::reset).doesNotThrowAnyException();

        assertInitialState(game);
        assertThat(game.board().pieces()).isEqualTo(firstReset);
    }

    @Test
    void resettingDoesNotMutateAnOldBoardReference() {
        Game game = game(Player.BLACK, at(3, 2, man(Player.BLACK)), at(6, 7, king(Player.WHITE)));
        Board previousBoard = game.board();
        Map<Position, Piece> previousPieces = Map.copyOf(previousBoard.pieces());

        assertThatCode(game::reset).doesNotThrowAnyException();
        assertAccepted(game, move(6, 1, 5, 0));

        assertThat(previousBoard.pieces()).isEqualTo(previousPieces);
        assertThat(game.board().pieceAt(pos(5, 0))).contains(man(Player.WHITE));
    }

    @Test
    void resettingOneGameDoesNotChangeAnotherGame() {
        Game first = game(Player.WHITE, at(6, 1, man(Player.WHITE)), at(1, 0, man(Player.BLACK)));
        Game second = game(Player.BLACK, at(3, 2, man(Player.BLACK)), at(6, 7, king(Player.WHITE)));
        Map<Position, Piece> secondPieces = Map.copyOf(second.board().pieces());

        assertThatCode(first::reset).doesNotThrowAnyException();
        assertAccepted(first, move(6, 1, 5, 0));

        assertThat(second.board().pieces()).isEqualTo(secondPieces);
        assertThat(second.currentPlayer()).isEqualTo(Player.BLACK);
        assertThat(second.status()).isEqualTo(GameStatus.IN_PROGRESS);
    }

    private static void assertInitialState(Game game) {
        Map<Position, Piece> expected = expectedInitialPieces();
        assertThat(game.currentPlayer()).isEqualTo(Player.WHITE);
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(game.board().pieces()).isEqualTo(expected);
        assertThat(game.board().pieces()).hasSize(40);
    }
}
