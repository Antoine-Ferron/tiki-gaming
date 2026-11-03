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

@DisplayName("US-11 — Fin de partie et victoire")
class GameEndTest {

    private final GameRules rules = new GameRules();

    @Test
    void blackWinsWhenWhiteHasNoPieceToPlay() {
        Board board = board(at(2, 1, man(Player.BLACK)));

        assertThat(rules.status(board, Player.WHITE)).isEqualTo(GameStatus.BLACK_WON);
    }

    @Test
    void whiteWinsWhenBlackHasNoPieceToPlay() {
        Board board = board(at(7, 0, man(Player.WHITE)));

        assertThat(rules.status(board, Player.BLACK)).isEqualTo(GameStatus.WHITE_WON);
    }

    @Test
    void blackWinsWhenWhiteStillHasAPieceButNoLegalMove() {
        // La sortie derrière le pion noir serait hors du plateau.
        Board board = board(at(1, 0, man(Player.WHITE)), at(0, 1, man(Player.BLACK)));

        assertThat(rules.status(board, Player.WHITE)).isEqualTo(GameStatus.BLACK_WON);
    }

    @Test
    void whiteWinsWhenBlackStillHasAPieceButNoLegalMove() {
        Board board = board(at(8, 9, man(Player.BLACK)), at(9, 8, king(Player.WHITE)));

        assertThat(rules.status(board, Player.BLACK)).isEqualTo(GameStatus.WHITE_WON);
    }

    @Test
    void gameContinuesWhenASimpleMoveRemains() {
        Board board = board(at(6, 1, man(Player.WHITE)), at(1, 0, man(Player.BLACK)));

        assertThat(rules.legalMoves(board, Player.WHITE)).contains(move(6, 1, 5, 0));
        assertThat(rules.status(board, Player.WHITE)).isEqualTo(GameStatus.IN_PROGRESS);
    }

    @Test
    void gameContinuesWhenTheOnlyLegalActionIsABackwardCapture() {
        // L'avance (0, 1) est bloquée ; la seule prise est vers (3, 2).
        Board board = board(at(1, 0, man(Player.WHITE)), at(0, 1, man(Player.BLACK)), at(2, 1, man(Player.BLACK)));

        assertThat(rules.legalMoves(board, Player.WHITE)).containsExactly(move(1, 0, 3, 2));
        assertThat(rules.status(board, Player.WHITE)).isEqualTo(GameStatus.IN_PROGRESS);
    }

    @Test
    void aKingAtTheEdgeCanKeepTheGameInProgressByMovingBackward() {
        Board board = board(at(0, 1, king(Player.WHITE)), at(8, 9, man(Player.BLACK)));

        assertThat(rules.legalMoves(board, Player.WHITE)).contains(move(0, 1, 3, 4));
        assertThat(rules.status(board, Player.WHITE)).isEqualTo(GameStatus.IN_PROGRESS);
    }

    @Test
    void takingTheLastBlackPieceAwardsWhiteTheVictory() {
        Game game = game(Player.WHITE, at(6, 1, man(Player.WHITE)), at(5, 2, man(Player.BLACK)));

        assertAccepted(game, move(6, 1, 4, 3));

        assertThat(game.status()).isEqualTo(GameStatus.WHITE_WON);
        assertThat(game.board().pieces()).containsOnlyKeys(pos(4, 3));
    }

    @Test
    void takingTheLastWhitePieceAwardsBlackTheVictory() {
        Game game = game(Player.BLACK, at(3, 2, man(Player.BLACK)), at(4, 3, man(Player.WHITE)));

        assertAccepted(game, move(3, 2, 5, 4));

        assertThat(game.status()).isEqualTo(GameStatus.BLACK_WON);
        assertThat(game.board().pieces()).containsOnlyKeys(pos(5, 4));
    }

    @Test
    void whiteCanWinByBlockingTheLastBlackManWithoutCapturingIt() {
        Game game = game(Player.WHITE, at(7, 6, king(Player.WHITE)), at(8, 9, man(Player.BLACK)));

        assertAccepted(game, move(7, 6, 9, 8));

        assertThat(game.board().pieceAt(pos(8, 9))).contains(man(Player.BLACK));
        assertThat(game.status()).isEqualTo(GameStatus.WHITE_WON);
    }

    @Test
    void blackCanWinByBlockingTheLastWhiteManWithoutCapturingIt() {
        Game game = game(Player.BLACK, at(2, 3, king(Player.BLACK)), at(1, 0, man(Player.WHITE)));

        assertAccepted(game, move(2, 3, 0, 1));

        assertThat(game.board().pieceAt(pos(1, 0))).contains(man(Player.WHITE));
        assertThat(game.status()).isEqualTo(GameStatus.BLACK_WON);
    }

    @Test
    void anIncompleteCaptureSequenceCannotEndTheGame() {
        Game game = game(
                Player.WHITE, at(6, 1, man(Player.WHITE)), at(5, 2, man(Player.BLACK)), at(3, 4, man(Player.BLACK)));

        assertRejected(game, move(6, 1, 4, 3));
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);

        assertAccepted(game, move(6, 1, 4, 3, 2, 5));
        assertThat(game.status()).isEqualTo(GameStatus.WHITE_WON);
    }

    @Test
    void aCommandAfterVictoryIsRejectedWithoutChangingTheTerminalState() {
        Game game = game(Player.WHITE, at(6, 1, man(Player.WHITE)), at(5, 2, man(Player.BLACK)));
        assertAccepted(game, move(6, 1, 4, 3));
        assertThat(game.status()).isEqualTo(GameStatus.WHITE_WON);

        assertRejected(game, move(4, 3, 3, 2));

        assertThat(game.status()).isEqualTo(GameStatus.WHITE_WON);
        assertThat(game.board().pieces()).containsOnlyKeys(pos(4, 3));
    }
}
