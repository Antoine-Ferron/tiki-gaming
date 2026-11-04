package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.assertAccepted;
import static fr.tikigaming.games.dame.DameTestSupport.assertRejected;
import static fr.tikigaming.games.dame.DameTestSupport.at;
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

@DisplayName("US-09 — Promotion en dame")
class PromotionTest {

    @ParameterizedTest
    @CsvSource({
        "WHITE, BLACK, 1, 2, 0, 1, 8, 9",
        "WHITE, BLACK, 1, 2, 0, 3, 8, 9",
        "BLACK, WHITE, 8, 7, 9, 6, 1, 0",
        "BLACK, WHITE, 8, 7, 9, 8, 1, 0"
    })
    void promotesOnAQuietMoveEndingOnTheOpponentsLastRank(
            Player player,
            Player opponent,
            int fromRow,
            int fromColumn,
            int toRow,
            int toColumn,
            int otherRow,
            int otherColumn) {
        Game game = game(player, at(fromRow, fromColumn, man(player)), at(otherRow, otherColumn, man(opponent)));

        assertAccepted(game, move(fromRow, fromColumn, toRow, toColumn));

        assertThat(game.board().pieceAt(pos(toRow, toColumn))).contains(king(player));
        assertThat(game.board().pieceAt(pos(fromRow, fromColumn))).isEmpty();
        assertThat(game.board().pieces()).hasSize(2);
        assertThat(game.currentPlayer()).isEqualTo(opponent);
    }

    @ParameterizedTest
    @CsvSource({
        "WHITE, BLACK, 2, 3, 1, 2, 0, 1",
        "WHITE, BLACK, 2, 3, 1, 4, 0, 5",
        "BLACK, WHITE, 7, 4, 8, 3, 9, 2",
        "BLACK, WHITE, 7, 4, 8, 5, 9, 6"
    })
    void promotesAfterACaptureEndingOnTheOpponentsLastRank(
            Player player,
            Player opponent,
            int fromRow,
            int fromColumn,
            int capturedRow,
            int capturedColumn,
            int toRow,
            int toColumn) {
        Game game = game(player, at(fromRow, fromColumn, man(player)), at(capturedRow, capturedColumn, man(opponent)));

        assertAccepted(game, move(fromRow, fromColumn, toRow, toColumn));

        assertThat(game.board().pieceAt(pos(toRow, toColumn))).contains(king(player));
        assertThat(game.board().pieceAt(pos(capturedRow, capturedColumn))).isEmpty();
        assertThat(game.board().pieces()).hasSize(1);
    }

    @Test
    void promotesWhiteOnlyAfterTheFinalJumpOfACompleteCapture() {
        Game game = game(
                Player.WHITE, at(4, 1, man(Player.WHITE)), at(3, 2, man(Player.BLACK)), at(1, 4, man(Player.BLACK)));

        assertAccepted(game, move(4, 1, 2, 3, 0, 5));

        assertThat(game.board().pieceAt(pos(0, 5))).contains(king(Player.WHITE));
        assertThat(game.board().pieces()).hasSize(1);
        assertThat(game.currentPlayer()).isEqualTo(Player.BLACK);
    }

    @Test
    void promotesBlackOnlyAfterTheFinalJumpOfACompleteCapture() {
        Game game = game(
                Player.BLACK, at(5, 2, man(Player.BLACK)), at(6, 3, man(Player.WHITE)), at(8, 5, man(Player.WHITE)));

        assertAccepted(game, move(5, 2, 7, 4, 9, 6));

        assertThat(game.board().pieceAt(pos(9, 6))).contains(king(Player.BLACK));
        assertThat(game.board().pieces()).hasSize(1);
        assertThat(game.currentPlayer()).isEqualTo(Player.WHITE);
    }

    @Test
    void keepsWhiteAsAManWhenTheCapturePassesThroughThePromotionRankAndLeavesIt() {
        Game game = game(
                Player.WHITE, at(2, 1, man(Player.WHITE)), at(1, 2, man(Player.BLACK)), at(1, 4, man(Player.BLACK)));

        assertAccepted(game, move(2, 1, 0, 3, 2, 5));

        assertThat(game.board().pieceAt(pos(2, 5))).contains(man(Player.WHITE));
        assertThat(game.board().pieceAt(pos(0, 3))).isEmpty();
        assertThat(game.board().pieces()).hasSize(1);
    }

    @Test
    void keepsBlackAsAManWhenTheCapturePassesThroughThePromotionRankAndLeavesIt() {
        Game game = game(
                Player.BLACK, at(7, 2, man(Player.BLACK)), at(8, 3, man(Player.WHITE)), at(8, 5, man(Player.WHITE)));

        assertAccepted(game, move(7, 2, 9, 4, 7, 6));

        assertThat(game.board().pieceAt(pos(7, 6))).contains(man(Player.BLACK));
        assertThat(game.board().pieceAt(pos(9, 4))).isEmpty();
        assertThat(game.board().pieces()).hasSize(1);
    }

    @Test
    void rejectsUsingFlyingKingPowersDuringTheCaptureThatReachesThePromotionRank() {
        Game game = game(
                Player.WHITE, at(2, 1, man(Player.WHITE)), at(1, 2, man(Player.BLACK)), at(2, 5, man(Player.BLACK)));
        Move prematureKingCapture = move(2, 1, 0, 3, 3, 6);

        assertRejected(game, prematureKingCapture);
    }

    @Test
    void offersThePromotionEndingBeforeADistantPieceThatOnlyAKingCouldCapture() {
        Game game = game(
                Player.WHITE, at(2, 1, man(Player.WHITE)), at(1, 2, man(Player.BLACK)), at(2, 5, man(Player.BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), Player.WHITE)).containsExactly(move(2, 1, 0, 3));
        assertAccepted(game, move(2, 1, 0, 3));

        assertThat(game.board().pieceAt(pos(0, 3))).contains(king(Player.WHITE));
        assertThat(game.board().pieceAt(pos(2, 5))).contains(man(Player.BLACK));
    }

    @Test
    void rejectsBlackUsingFlyingKingPowersBeforeItsPromotionCaptureHasEnded() {
        Game game = game(
                Player.BLACK, at(7, 2, man(Player.BLACK)), at(8, 3, man(Player.WHITE)), at(7, 6, man(Player.WHITE)));

        assertRejected(game, move(7, 2, 9, 4, 6, 7));
    }

    @ParameterizedTest
    @CsvSource({"WHITE, BLACK, 2, 1, 1, 0, 8, 9", "BLACK, WHITE, 7, 2, 8, 3, 1, 0"})
    void doesNotPromoteBeforeTheLastRank(
            Player player,
            Player opponent,
            int fromRow,
            int fromColumn,
            int toRow,
            int toColumn,
            int otherRow,
            int otherColumn) {
        Game game = game(player, at(fromRow, fromColumn, man(player)), at(otherRow, otherColumn, man(opponent)));

        assertAccepted(game, move(fromRow, fromColumn, toRow, toColumn));

        assertThat(game.board().pieceAt(pos(toRow, toColumn))).contains(man(player));
        assertThat(game.board().pieces()).hasSize(2);
    }

    @ParameterizedTest
    @CsvSource({"WHITE, BLACK, 7, 2, 8, 3, 9, 4", "BLACK, WHITE, 2, 1, 1, 2, 0, 3"})
    void doesNotPromoteWhenACaptureEndsOnItsOwnHomeRank(
            Player player,
            Player opponent,
            int fromRow,
            int fromColumn,
            int capturedRow,
            int capturedColumn,
            int toRow,
            int toColumn) {
        Game game = game(player, at(fromRow, fromColumn, man(player)), at(capturedRow, capturedColumn, man(opponent)));

        assertAccepted(game, move(fromRow, fromColumn, toRow, toColumn));

        assertThat(game.board().pieceAt(pos(toRow, toColumn))).contains(man(player));
        assertThat(game.board().pieces()).hasSize(1);
    }

    @Test
    void cannotMoveTheNewKingAgainBeforeTheOpponentsTurn() {
        Game game = game(Player.WHITE, at(1, 2, man(Player.WHITE)), at(8, 9, man(Player.BLACK)));
        assertAccepted(game, move(1, 2, 0, 1));

        assertRejected(game, move(0, 1, 3, 4));

        assertThat(game.currentPlayer()).isEqualTo(Player.BLACK);
        assertThat(game.board().pieceAt(pos(0, 1))).contains(king(Player.WHITE));
    }

    @Test
    void mayUseFlyingKingMovementOnTheNextTurnAfterPromotion() {
        Game game = game(Player.WHITE, at(1, 2, man(Player.WHITE)), at(8, 9, man(Player.BLACK)));
        assertAccepted(game, move(1, 2, 0, 1));
        assertAccepted(game, move(8, 9, 9, 8));

        assertAccepted(game, move(0, 1, 4, 5));

        assertThat(game.board().pieceAt(pos(4, 5))).contains(king(Player.WHITE));
        assertThat(game.board().pieceAt(pos(9, 8))).contains(king(Player.BLACK));
        assertThat(game.board().pieces()).hasSize(2);
    }
}
