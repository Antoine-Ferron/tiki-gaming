package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.assertAccepted;
import static fr.tikigaming.games.dame.DameTestSupport.assertRejected;
import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.board;
import static fr.tikigaming.games.dame.DameTestSupport.game;
import static fr.tikigaming.games.dame.DameTestSupport.king;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static fr.tikigaming.games.dame.DameTestSupport.pos;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("US-10 — Déplacements et captures des dames")
class KingMovementTest {

    @ParameterizedTest
    @CsvSource({
        "4, 3", "2, 1", "1, 0",
        "4, 5", "2, 7", "1, 8",
        "6, 3", "8, 1", "9, 0",
        "6, 5", "8, 7", "9, 8"
    })
    void movesAlongEachFreeDiagonalAtDifferentDistances(int toRow, int toColumn) {
        Game game = game(Player.WHITE, at(5, 4, king(Player.WHITE)), at(0, 1, man(Player.BLACK)));

        assertAccepted(game, move(5, 4, toRow, toColumn));

        assertThat(game.board().pieceAt(pos(toRow, toColumn))).contains(king(Player.WHITE));
        assertThat(game.board().pieceAt(pos(5, 4))).isEmpty();
        assertThat(game.board().pieces()).hasSize(2);
        assertThat(game.currentPlayer()).isEqualTo(Player.BLACK);
    }

    @Test
    void letsBlackMoveItsKingBackwardsOverSeveralSquares() {
        Game game = game(Player.BLACK, at(7, 2, king(Player.BLACK)), at(1, 0, man(Player.WHITE)));

        assertAccepted(game, move(7, 2, 3, 6));

        assertThat(game.board().pieceAt(pos(3, 6))).contains(king(Player.BLACK));
        assertThat(game.board().pieces()).hasSize(2);
    }

    @Test
    void crossesTheFullNineSquareDistanceOfTheLongDiagonal() {
        Game game = game(Player.WHITE, at(9, 0, king(Player.WHITE)), at(0, 1, man(Player.BLACK)));

        assertAccepted(game, move(9, 0, 0, 9));

        assertThat(game.board().pieceAt(pos(0, 9))).contains(king(Player.WHITE));
        assertThat(game.board().pieces()).hasSize(2);
    }

    @ParameterizedTest
    @CsvSource({"5, 6", "3, 4", "2, 5", "4, 4", "5, 4"})
    void rejectsNonDiagonalOrZeroLengthKingMoves(int toRow, int toColumn) {
        Game game = game(Player.WHITE, at(5, 4, king(Player.WHITE)), at(0, 1, man(Player.BLACK)));

        assertRejected(game, move(5, 4, toRow, toColumn));
    }

    @ParameterizedTest
    @CsvSource({"3, 2", "2, 1", "1, 0"})
    void cannotLandOnOrPassThroughAnAlliedPiece(int toRow, int toColumn) {
        Game game = game(
                Player.WHITE, at(5, 4, king(Player.WHITE)), at(3, 2, man(Player.WHITE)), at(0, 7, man(Player.BLACK)));

        assertRejected(game, move(5, 4, toRow, toColumn));
    }

    @ParameterizedTest
    @CsvSource({"3, 4", "2, 5", "1, 6", "0, 7"})
    void canChooseAnyFreeLandingBeyondOneDistantOpponent(int toRow, int toColumn) {
        Game game = game(Player.WHITE, at(7, 0, king(Player.WHITE)), at(4, 3, man(Player.BLACK)));

        assertAccepted(game, move(7, 0, toRow, toColumn));

        assertThat(game.board().pieceAt(pos(toRow, toColumn))).contains(king(Player.WHITE));
        assertThat(game.board().pieceAt(pos(4, 3))).isEmpty();
        assertThat(game.board().pieces()).hasSize(1);
    }

    @Test
    void listsAllLandingChoicesBeyondASingleDistantOpponent() {
        Board board = board(at(7, 0, king(Player.WHITE)), at(4, 3, man(Player.BLACK)));

        assertThat(new GameRules().legalMoves(board, Player.WHITE))
                .containsExactlyInAnyOrder(move(7, 0, 3, 4), move(7, 0, 2, 5), move(7, 0, 1, 6), move(7, 0, 0, 7));
    }

    @ParameterizedTest
    @CsvSource({"3, 2, 1, 0", "3, 6, 1, 8", "7, 2, 9, 0", "7, 6, 9, 8"})
    void capturesOverDistantOpponentsInAllFourDirections(int capturedRow, int capturedColumn, int toRow, int toColumn) {
        Game game =
                game(Player.WHITE, at(5, 4, king(Player.WHITE)), at(capturedRow, capturedColumn, man(Player.BLACK)));

        assertAccepted(game, move(5, 4, toRow, toColumn));

        assertThat(game.board().pieceAt(pos(toRow, toColumn))).contains(king(Player.WHITE));
        assertThat(game.board().pieceAt(pos(capturedRow, capturedColumn))).isEmpty();
        assertThat(game.board().pieces()).hasSize(1);
    }

    @Test
    void cannotLandOnThePieceBeingCaptured() {
        Game game = game(Player.WHITE, at(7, 0, king(Player.WHITE)), at(4, 3, man(Player.BLACK)));

        assertRejected(game, move(7, 0, 4, 3));
    }

    @Test
    void cannotJumpOverTwoOpponentsInASingleSegment() {
        Game game = game(
                Player.WHITE, at(5, 4, king(Player.WHITE)), at(3, 2, man(Player.BLACK)), at(2, 1, man(Player.BLACK)));

        assertRejected(game, move(5, 4, 1, 0));
    }

    @Test
    void cannotCrossAnAlliedPieceToCaptureAnOpponentBehindIt() {
        Game game = game(
                Player.WHITE, at(7, 0, king(Player.WHITE)), at(5, 2, man(Player.WHITE)), at(3, 4, man(Player.BLACK)));

        assertRejected(game, move(7, 0, 1, 6));
    }

    @Test
    void mayMakeAQuietMoveWhenTheOnlyOpponentOnADiagonalHasNoLandingBeyondIt() {
        Game game = game(Player.WHITE, at(2, 1, king(Player.WHITE)), at(0, 3, man(Player.BLACK)));

        assertAccepted(game, move(2, 1, 3, 0));

        assertThat(game.board().pieceAt(pos(3, 0))).contains(king(Player.WHITE));
        assertThat(game.board().pieceAt(pos(0, 3))).contains(man(Player.BLACK));
        assertThat(game.board().pieces()).hasSize(2);
    }

    @Test
    void mustCaptureInsteadOfStoppingOnAFreeSquareBeforeTheOpponent() {
        Game game = game(Player.WHITE, at(7, 0, king(Player.WHITE)), at(4, 3, man(Player.BLACK)));

        assertRejected(game, move(7, 0, 6, 1));
    }

    @Test
    void canCaptureAManAndAKingInTheSameSequence() {
        Game game = game(
                Player.WHITE, at(9, 0, king(Player.WHITE)), at(6, 3, man(Player.BLACK)), at(2, 7, king(Player.BLACK)));

        assertAccepted(game, move(9, 0, 4, 5, 0, 9));

        assertThat(game.board().pieceAt(pos(0, 9))).contains(king(Player.WHITE));
        assertThat(game.board().pieces()).hasSize(1);
        assertThat(game.currentPlayer()).isEqualTo(Player.BLACK);
    }

    @Test
    void requiresAnIntermediateLandingBetweenTwoCapturesOnTheSameDiagonal() {
        Game game = game(
                Player.WHITE, at(9, 0, king(Player.WHITE)), at(6, 3, man(Player.BLACK)), at(2, 7, king(Player.BLACK)));

        assertRejected(game, move(9, 0, 0, 9));
    }

    @Test
    void continuesACaptureByChangingDiagonal() {
        Game game = game(
                Player.WHITE, at(7, 0, king(Player.WHITE)), at(4, 3, man(Player.BLACK)), at(2, 3, man(Player.BLACK)));

        assertAccepted(game, move(7, 0, 3, 4, 1, 2));

        assertThat(game.board().pieceAt(pos(1, 2))).contains(king(Player.WHITE));
        assertThat(game.board().pieces()).hasSize(1);
    }

    @Test
    void choosesTheIntermediateLandingThatAllowsTheMaximumNumberOfCaptures() {
        Board board = board(at(7, 0, king(Player.WHITE)), at(4, 3, man(Player.BLACK)), at(2, 3, man(Player.BLACK)));

        assertThat(new GameRules().legalMoves(board, Player.WHITE))
                .containsExactlyInAnyOrder(move(7, 0, 3, 4, 1, 2), move(7, 0, 3, 4, 0, 1));
    }

    @Test
    void rejectsAMinorityLandingThatPreventsTheSecondCapture() {
        Game game = game(
                Player.WHITE, at(7, 0, king(Player.WHITE)), at(4, 3, man(Player.BLACK)), at(2, 3, man(Player.BLACK)));

        assertRejected(game, move(7, 0, 2, 5));
    }

    @Test
    void givesNoExtraValueToCapturingAKingRatherThanAMan() {
        Board board = board(at(5, 4, king(Player.WHITE)), at(3, 2, man(Player.BLACK)), at(3, 6, king(Player.BLACK)));

        assertThat(new GameRules().legalMoves(board, Player.WHITE))
                .containsExactlyInAnyOrder(
                        move(5, 4, 2, 1), move(5, 4, 1, 0), move(5, 4, 2, 7), move(5, 4, 1, 8), move(5, 4, 0, 9));
    }

    @Test
    void cannotRemoveTheFirstCapturedPieceEarlyToOpenAReverseDiagonal() {
        Game game = game(
                Player.WHITE, at(5, 4, king(Player.WHITE)), at(3, 2, man(Player.BLACK)), at(7, 6, man(Player.BLACK)));

        assertRejected(game, move(5, 4, 1, 0, 9, 8));
    }

    @Test
    void allowsOneCaptureWhenTheCapturedPieceBlocksTheReverseContinuation() {
        Game game = game(
                Player.WHITE, at(5, 4, king(Player.WHITE)), at(3, 2, man(Player.BLACK)), at(7, 6, man(Player.BLACK)));

        assertAccepted(game, move(5, 4, 1, 0));

        assertThat(game.board().pieceAt(pos(1, 0))).contains(king(Player.WHITE));
        assertThat(game.board().pieceAt(pos(7, 6))).contains(man(Player.BLACK));
        assertThat(game.board().pieceAt(pos(3, 2))).isEmpty();
        assertThat(game.board().pieces()).hasSize(2);
    }

    @Test
    void mayReturnToItsStartingSquareWhileCapturingFourDistinctPieces() {
        Game game = game(
                Player.WHITE,
                at(6, 3, king(Player.WHITE)),
                at(4, 5, man(Player.BLACK)),
                at(1, 4, man(Player.BLACK)),
                at(1, 2, man(Player.BLACK)),
                at(4, 1, man(Player.BLACK)));
        Move cycle = move(6, 3, 3, 6, 0, 3, 3, 0, 6, 3);

        assertThat(new GameRules().legalMoves(game.board(), Player.WHITE)).contains(cycle);
        assertAccepted(game, cycle);

        assertThat(game.board().pieceAt(pos(6, 3))).contains(king(Player.WHITE));
        assertThat(game.board().pieces()).hasSize(1);
        assertThat(game.currentPlayer()).isEqualTo(Player.BLACK);
    }
}
