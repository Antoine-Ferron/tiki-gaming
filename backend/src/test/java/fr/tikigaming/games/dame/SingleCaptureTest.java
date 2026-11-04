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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("US-06 — Capture simple des pions")
class SingleCaptureTest {

    @ParameterizedTest(name = "{0} capture vers ({3}, {4})")
    @CsvSource({
        "WHITE, 3, 4, 2, 3",
        "WHITE, 3, 6, 2, 7",
        "WHITE, 5, 4, 6, 3",
        "WHITE, 5, 6, 6, 7",
        "BLACK, 3, 4, 2, 3",
        "BLACK, 3, 6, 2, 7",
        "BLACK, 5, 4, 6, 3",
        "BLACK, 5, 6, 6, 7"
    })
    void capturesAnAdjacentOpponentInEachDiagonalDirection(
            Player player, int capturedRow, int capturedColumn, int landingRow, int landingColumn) {
        // Arrange : l'adversaire éloigné laisse la partie continuer après la prise.
        Player opponent = player == WHITE ? BLACK : WHITE;
        int distantRow = opponent == WHITE ? 9 : 0;
        int distantColumn = opponent == WHITE ? 8 : 1;
        Game game = game(
                player,
                at(4, 5, man(player)),
                at(capturedRow, capturedColumn, man(opponent)),
                at(distantRow, distantColumn, man(opponent)));
        Move capture = move(4, 5, landingRow, landingColumn);

        // Act
        assertAccepted(game, capture);

        // Assert
        assertThat(game.board().pieceAt(pos(4, 5))).isEmpty();
        assertThat(game.board().pieceAt(pos(capturedRow, capturedColumn))).isEmpty();
        assertThat(game.board().pieceAt(pos(landingRow, landingColumn))).contains(man(player));
        assertThat(game.board().pieceAt(pos(distantRow, distantColumn))).contains(man(opponent));
        assertThat(game.board().pieces()).hasSize(2);
        assertThat(game.currentPlayer()).isEqualTo(opponent);
    }

    @Test
    void exposesTheCompleteSingleCaptureAsTheOnlyLegalMove() {
        Game game = game(WHITE, at(6, 1, man(WHITE)), at(5, 2, man(BLACK)), at(0, 9, man(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE)).containsExactly(move(6, 1, 4, 3));
    }

    @Test
    void rejectsJumpingOverAnEmptySquare() {
        Game game = game(WHITE, at(4, 5, man(WHITE)), at(0, 9, man(BLACK)));

        assertRejected(game, move(4, 5, 2, 3));
    }

    @Test
    void rejectsCapturingAnAlliedPiece() {
        Game game = game(WHITE, at(4, 5, man(WHITE)), at(3, 4, man(WHITE)), at(0, 9, man(BLACK)));

        assertRejected(game, move(4, 5, 2, 3));
    }

    @Test
    void rejectsLandingOnAnAlliedPiece() {
        Game game = game(WHITE, at(4, 5, man(WHITE)), at(3, 4, man(BLACK)), at(2, 3, man(WHITE)), at(0, 9, man(BLACK)));

        assertRejected(game, move(4, 5, 2, 3));
    }

    @Test
    void rejectsLandingOnAnotherOpponent() {
        Game game = game(WHITE, at(4, 5, man(WHITE)), at(3, 4, man(BLACK)), at(2, 3, man(BLACK)), at(0, 9, man(BLACK)));

        assertRejected(game, move(4, 5, 2, 3));
    }

    @Test
    void allowsACaptureLandingOnTheBoardEdge() {
        Game game = game(WHITE, at(2, 1, man(WHITE)), at(1, 2, man(BLACK)), at(0, 9, man(BLACK)));

        assertAccepted(game, move(2, 1, 0, 3));

        assertThat(game.board().pieceAt(pos(1, 2))).isEmpty();
        assertThat(game.board().pieceAt(pos(0, 3)))
                .hasValueSatisfying(piece -> assertThat(piece.owner()).isEqualTo(WHITE));
        assertThat(game.board().pieces()).hasSize(2);
    }

    @Test
    void doesNotTreatAnOpponentAtTheEdgeAsCapturableWithoutALandingSquare() {
        Game game = game(WHITE, at(1, 2, man(WHITE)), at(0, 1, man(BLACK)));

        assertThat(new GameRules().legalMoves(game.board(), WHITE)).containsExactly(move(1, 2, 0, 3));
    }
}
