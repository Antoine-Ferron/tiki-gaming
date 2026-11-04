package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.board;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.pos;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertAll;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BoardTest {

    @Test
    void hasTenRowsAndTenColumns() {
        // Arrange
        Board board = new Board();

        // Act
        int rows = board.rowCount();
        int columns = board.columnCount();

        // Assert
        assertAll(
                () -> assertThat(rows).as("nombre de lignes").isEqualTo(10),
                () -> assertThat(columns).as("nombre de colonnes").isEqualTo(10));
    }

    @Test
    void startsWithOneHundredEmptySquares() {
        // Arrange
        Board board = new Board();

        for (int row = 0; row < 10; row++) {
            for (int column = 0; column < 10; column++) {
                // Act
                boolean empty = board.isEmpty(row, column);

                // Assert
                assertThat(empty)
                        .as("la case (%s, %s) d'un damier neuf est vide", row, column)
                        .isTrue();
            }
        }
    }

    @Test
    void hasFiftyPlayableSquares() {
        // Arrange
        Board board = new Board();

        // Act
        int playableSquares = 0;
        for (int row = 0; row < board.rowCount(); row++) {
            for (int column = 0; column < board.columnCount(); column++) {
                if (board.isPlayable(row, column)) {
                    playableSquares++;
                }
            }
        }

        // Assert
        assertThat(playableSquares).as("nombre de cases jouables").isEqualTo(50);
    }

    @ParameterizedTest(name = "case ({0}, {1}) jouable : {2}")
    @CsvSource({
        "0, 0, false", "0, 9, true", "9, 0, true", "9, 9, false",
        "0, 1, true", "1, 0, true", "1, 1, false", "1, 2, true",
        "4, 4, false", "4, 5, true", "8, 9, true", "9, 8, true"
    })
    void identifiesThePlayableSquaresIncludingAllCorners(int row, int column, boolean expected) {
        Board board = new Board();

        assertThat(board.isPlayable(row, column)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"-1, 0", "0, -1", "10, 0", "0, 10", "-1, -1", "10, 10", "-2147483648, 5", "5, 2147483647"})
    void rejectsCoordinatesOutsideTheBoard(int row, int column) {
        Board board = new Board();

        assertAll(
                () -> assertThatThrownBy(() -> board.isEmpty(row, column)).isInstanceOf(IllegalArgumentException.class),
                () -> assertThatThrownBy(() -> board.isPlayable(row, column))
                        .isInstanceOf(IllegalArgumentException.class),
                () -> assertThatThrownBy(() -> board.pieceAt(new Position(row, column)))
                        .isInstanceOf(IllegalArgumentException.class));
    }

    @Test
    void observesTheExplicitPiecesOfAPosition() {
        Board board = board(at(6, 1, man(Player.WHITE)), at(3, 8, man(Player.BLACK)));

        assertAll(
                () -> assertThat(board.isEmpty(6, 1)).isFalse(),
                () -> assertThat(board.pieceAt(pos(6, 1))).contains(man(Player.WHITE)),
                () -> assertThat(board.isEmpty(5, 2)).isTrue(),
                () -> assertThat(board.pieceAt(pos(5, 2))).isEmpty());
    }

    @Test
    void rejectsAPieceOnALightSquare() {
        assertThatThrownBy(() -> new Board(Map.of(pos(0, 0), man(Player.WHITE))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void keepsASnapshotOfTheProvidedPosition() {
        Map<Position, Piece> source = new HashMap<>();
        source.put(pos(6, 1), man(Player.WHITE));
        Board board = new Board(source);

        source.clear();

        assertThat(board.pieces()).containsExactlyEntriesOf(Map.of(pos(6, 1), man(Player.WHITE)));
    }

    @Test
    void doesNotExposeAMutablePosition() {
        Board board = board(at(6, 1, man(Player.WHITE)));

        assertThatThrownBy(() -> board.pieces().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThat(board.pieces()).containsExactlyEntriesOf(Map.of(pos(6, 1), man(Player.WHITE)));
    }
}
