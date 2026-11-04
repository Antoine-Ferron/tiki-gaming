package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.assertAccepted;
import static fr.tikigaming.games.dame.DameTestSupport.assertRejected;
import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.game;
import static fr.tikigaming.games.dame.DameTestSupport.king;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static fr.tikigaming.games.dame.DameTestSupport.pos;
import static fr.tikigaming.games.dame.Player.BLACK;
import static fr.tikigaming.games.dame.Player.WHITE;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("US-08 — Rafles complètes et prise majoritaire")
class MultipleCaptureTest {

    @Test
    void completesATwoPieceCaptureWithOneChangeOfTurn() {
        Game game = twoCaptureGame();

        assertAccepted(game, move(6, 1, 4, 3, 2, 5));

        assertThat(game.board().pieceAt(pos(6, 1))).isEmpty();
        assertThat(game.board().pieceAt(pos(4, 3))).isEmpty();
        assertThat(game.board().pieceAt(pos(5, 2))).isEmpty();
        assertThat(game.board().pieceAt(pos(3, 4))).isEmpty();
        assertThat(game.board().pieceAt(pos(2, 5))).contains(man(WHITE));
        assertThat(game.board().pieceAt(pos(0, 9))).contains(man(BLACK));
        assertThat(game.board().pieces()).hasSize(2);
        assertThat(game.currentPlayer()).isEqualTo(BLACK);
    }

    @Test
    void exposesOnlyTheCompletePathWhenTheSamePieceMustContinue() {
        Game game = twoCaptureGame();

        assertThat(new GameRules().legalMoves(game.board(), WHITE)).containsExactly(move(6, 1, 4, 3, 2, 5));
    }

    @Test
    void rejectsStoppingAfterTheFirstCaptureWithoutChangingTheState() {
        Game game = twoCaptureGame();

        assertRejected(game, move(6, 1, 4, 3));
    }

    @Test
    void rejectsOmittingAnIntermediateLandingFromTheCapturePath() {
        Game game = twoCaptureGame();

        assertRejected(game, move(6, 1, 2, 5));
    }

    @Test
    void rejectsFinishingTheCaptureWithAnotherPiece() {
        Game game = game(
                WHITE,
                at(6, 1, man(WHITE)),
                at(4, 7, man(WHITE)),
                at(5, 2, man(BLACK)),
                at(3, 4, man(BLACK)),
                at(3, 8, man(BLACK)));

        // (2,9) est accessible depuis la seconde pièce (4,7), pas depuis (4,3).
        assertRejected(game, move(6, 1, 4, 3, 2, 9));
    }

    @Test
    void comparesCaptureLengthsAcrossAllPiecesOfTheCamp() {
        Game game = threeVersusTwoGame();

        assertThat(new GameRules().legalMoves(game.board(), WHITE)).containsExactly(move(6, 1, 4, 3, 2, 1, 0, 3));
    }

    @Test
    void rejectsTwoCapturesWhenAnotherPieceCanCaptureThree() {
        Game game = threeVersusTwoGame();

        assertRejected(game, move(8, 7, 6, 9, 4, 7));
    }

    @Test
    void acceptsTheGlobalMaximumAndRemovesExactlyThreeOpponents() {
        Game game = threeVersusTwoGame();

        assertAccepted(game, move(6, 1, 4, 3, 2, 1, 0, 3));

        assertThat(game.board().pieceAt(pos(5, 2))).isEmpty();
        assertThat(game.board().pieceAt(pos(3, 2))).isEmpty();
        assertThat(game.board().pieceAt(pos(1, 2))).isEmpty();
        assertThat(game.board().pieceAt(pos(0, 3)))
                .hasValueSatisfying(piece -> assertThat(piece.owner()).isEqualTo(WHITE));
        assertThat(game.board().pieceAt(pos(8, 7))).contains(man(WHITE));
        assertThat(game.board().pieceAt(pos(7, 8))).contains(man(BLACK));
        assertThat(game.board().pieceAt(pos(5, 8))).contains(man(BLACK));
        assertThat(game.board().pieces()).hasSize(4);
        assertThat(game.currentPlayer()).isEqualTo(BLACK);
    }

    @Test
    void rejectsTheShorterBranchOfTheSamePiece() {
        Game game = game(WHITE, at(6, 3, man(WHITE)), at(5, 2, man(BLACK)), at(5, 4, man(BLACK)), at(3, 6, man(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE)).containsExactly(move(6, 3, 4, 5, 2, 7));
        assertRejected(game, move(6, 3, 4, 1));
    }

    @Test
    void offersBothMaximalBranchesWhenTheyTakeTheSameNumberOfPieces() {
        Game game = equalBranchesGame();

        assertThat(new GameRules().legalMoves(game.board(), WHITE))
                .containsExactlyInAnyOrder(move(6, 3, 4, 1, 2, 3), move(6, 3, 4, 5, 2, 7));
    }

    @Test
    void allowsChoosingEitherEqualMaximalBranch() {
        Game left = equalBranchesGame();
        Game right = equalBranchesGame();

        assertAccepted(left, move(6, 3, 4, 1, 2, 3));
        assertAccepted(right, move(6, 3, 4, 5, 2, 7));

        assertThat(left.board().pieceAt(pos(2, 3))).contains(man(WHITE));
        assertThat(right.board().pieceAt(pos(2, 7))).contains(man(WHITE));
        assertThat(left.board().pieces()).hasSize(3);
        assertThat(right.board().pieces()).hasSize(3);
    }

    @Test
    void offersEqualMaximalPathsFromDifferentPieces() {
        Game game = game(
                WHITE,
                at(6, 1, man(WHITE)),
                at(8, 7, man(WHITE)),
                at(5, 2, man(BLACK)),
                at(3, 2, man(BLACK)),
                at(7, 8, man(BLACK)),
                at(5, 8, man(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE))
                .containsExactlyInAnyOrder(move(6, 1, 4, 3, 2, 1), move(8, 7, 6, 9, 4, 7));
    }

    @Test
    void doesNotPreferCapturingAKingOverAManWhenCountsAreEqual() {
        Game game = game(WHITE, at(4, 5, man(WHITE)), at(3, 4, man(BLACK)), at(3, 6, king(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE))
                .containsExactlyInAnyOrder(move(4, 5, 2, 3), move(4, 5, 2, 7));
        assertAccepted(game, move(4, 5, 2, 3));
        assertThat(game.board().pieceAt(pos(3, 6))).contains(king(BLACK));
    }

    @Test
    void doesNotGiveAnAlliedKingPriorityOverAManTakingTheSameNumber() {
        // Le pion blanc (6,7) bloque aussi une éventuelle deuxième prise de la dame.
        Game game =
                game(WHITE, at(6, 1, king(WHITE)), at(6, 7, man(WHITE)), at(5, 2, man(BLACK)), at(7, 8, man(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE)).contains(move(6, 7, 8, 9));
        assertAccepted(game, move(6, 7, 8, 9));
        assertThat(game.board().pieceAt(pos(6, 1))).contains(king(WHITE));
        assertThat(game.board().pieceAt(pos(7, 8))).isEmpty();
    }

    @Test
    void rejectsCapturingTheSamePieceTwice() {
        Game game = game(WHITE, at(6, 1, man(WHITE)), at(5, 2, man(BLACK)), at(0, 9, man(BLACK)));

        assertRejected(game, move(6, 1, 4, 3, 6, 1));
    }

    @Test
    void allowsReturningToTheVacatedOriginWhileCapturingDistinctPieces() {
        Game game = game(
                WHITE,
                at(6, 3, man(WHITE)),
                at(5, 4, man(BLACK)),
                at(3, 4, man(BLACK)),
                at(3, 2, man(BLACK)),
                at(5, 2, man(BLACK)),
                at(0, 9, man(BLACK)));
        Move clockwise = move(6, 3, 4, 5, 2, 3, 4, 1, 6, 3);
        Move counterclockwise = move(6, 3, 4, 1, 2, 3, 4, 5, 6, 3);

        assertThat(new GameRules().legalMoves(game.board(), WHITE))
                .containsExactlyInAnyOrder(clockwise, counterclockwise);
        assertAccepted(game, clockwise);

        assertThat(game.board().pieceAt(pos(6, 3))).contains(man(WHITE));
        assertThat(game.board().pieceAt(pos(5, 4))).isEmpty();
        assertThat(game.board().pieceAt(pos(3, 4))).isEmpty();
        assertThat(game.board().pieceAt(pos(3, 2))).isEmpty();
        assertThat(game.board().pieceAt(pos(5, 2))).isEmpty();
        assertThat(game.board().pieces()).hasSize(2);
        assertThat(game.currentPlayer()).isEqualTo(BLACK);
    }

    @Test
    void leavesTheWholePositionUntouchedWhenTheFinalLandingIsOccupied() {
        Game game = game(
                WHITE,
                at(6, 1, man(WHITE)),
                at(5, 2, man(BLACK)),
                at(3, 4, man(BLACK)),
                at(2, 5, man(WHITE)),
                at(0, 9, man(BLACK)));

        assertRejected(game, move(6, 1, 4, 3, 2, 5));
    }

    private static Game twoCaptureGame() {
        return game(WHITE, at(6, 1, man(WHITE)), at(5, 2, man(BLACK)), at(3, 4, man(BLACK)), at(0, 9, man(BLACK)));
    }

    private static Game threeVersusTwoGame() {
        // Deux zones indépendantes : 3 prises à gauche, 2 prises à droite.
        return game(
                WHITE,
                at(6, 1, man(WHITE)),
                at(8, 7, man(WHITE)),
                at(5, 2, man(BLACK)),
                at(3, 2, man(BLACK)),
                at(1, 2, man(BLACK)),
                at(7, 8, man(BLACK)),
                at(5, 8, man(BLACK)));
    }

    private static Game equalBranchesGame() {
        return game(
                WHITE,
                at(6, 3, man(WHITE)),
                at(5, 2, man(BLACK)),
                at(3, 2, man(BLACK)),
                at(5, 4, man(BLACK)),
                at(3, 6, man(BLACK)));
    }
}
