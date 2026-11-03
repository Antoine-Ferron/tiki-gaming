package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.assertAccepted;
import static fr.tikigaming.games.dame.DameTestSupport.assertRejected;
import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.game;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static fr.tikigaming.games.dame.DameTestSupport.pos;
import static fr.tikigaming.games.dame.Player.BLACK;
import static fr.tikigaming.games.dame.Player.WHITE;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("US-07 — Capture obligatoire pour tout le camp")
class MandatoryCaptureTest {

    @Test
    void listsOnlyTheCaptureWhenAnotherPieceCouldMakeASimpleMove() {
        Game game = game(WHITE, at(6, 1, man(WHITE)), at(5, 2, man(BLACK)), at(6, 5, man(WHITE)), at(0, 9, man(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE)).containsExactly(move(6, 1, 4, 3));
    }

    @Test
    void rejectsASimpleMoveByThePieceThatCanCapture() {
        Game game = game(WHITE, at(6, 1, man(WHITE)), at(5, 2, man(BLACK)), at(0, 9, man(BLACK)));

        assertRejected(game, move(6, 1, 5, 0));
    }

    @Test
    void rejectsASimpleMoveByAnotherPieceWhenACaptureExistsElsewhere() {
        Game game = game(WHITE, at(6, 1, man(WHITE)), at(5, 2, man(BLACK)), at(6, 5, man(WHITE)), at(0, 9, man(BLACK)));

        assertRejected(game, move(6, 5, 5, 4));
    }

    @Test
    void aBackwardCaptureIsAlsoMandatoryForWhite() {
        Game game = game(WHITE, at(4, 3, man(WHITE)), at(5, 4, man(BLACK)), at(0, 9, man(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE)).containsExactly(move(4, 3, 6, 5));
        assertRejected(game, move(4, 3, 3, 2));
    }

    @Test
    void aBackwardCaptureIsAlsoMandatoryForBlack() {
        Game game = game(BLACK, at(4, 5, man(BLACK)), at(3, 4, man(WHITE)), at(9, 8, man(WHITE)));

        assertThat(new GameRules().legalMoves(game.board(), BLACK)).containsExactly(move(4, 5, 2, 3));
        assertRejected(game, move(4, 5, 5, 6));
    }

    @Test
    void allowsOrdinaryMovesWhenTheCampHasNoCapture() {
        Game game = game(WHITE, at(6, 1, man(WHITE)), at(6, 5, man(WHITE)), at(0, 9, man(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE))
                .containsExactlyInAnyOrder(move(6, 1, 5, 0), move(6, 1, 5, 2), move(6, 5, 5, 4), move(6, 5, 5, 6));
        assertAccepted(game, move(6, 5, 5, 4));
        assertThat(game.board().pieceAt(pos(5, 4))).contains(man(WHITE));
        assertThat(game.currentPlayer()).isEqualTo(BLACK);
    }
}
