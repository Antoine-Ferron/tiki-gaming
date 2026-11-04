package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.expectedInitialPieces;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class InitialPlacementTest {

    @Test
    void startsWithExactlyFortyMenTwentyOfEachColour() {
        Board board = Board.initial();

        assertThat(board.pieces()).hasSize(40);
        assertThat(board.pieces().values())
                .filteredOn(piece -> piece.owner() == Player.WHITE)
                .hasSize(20);
        assertThat(board.pieces().values())
                .filteredOn(piece -> piece.owner() == Player.BLACK)
                .hasSize(20);
        assertThat(board.pieces().values()).noneMatch(Piece::king);
    }

    @Test
    void placesEveryManOnTheSpecifiedStartingSquare() {
        Board board = Board.initial();

        assertThat(board.pieces()).containsExactlyInAnyOrderEntriesOf(expectedInitialPieces());
    }

    @ParameterizedTest
    @CsvSource({"0, 5", "1, 5", "2, 5", "3, 5", "4, 0", "5, 0", "6, 5", "7, 5", "8, 5", "9, 5"})
    void placesFiveMenOnEachStartingRowAndLeavesTheCentreEmpty(int row, int count) {
        Board board = Board.initial();

        assertThat(board.pieces().entrySet())
                .filteredOn(entry -> entry.getKey().row() == row)
                .hasSize(count);
    }

    @Test
    void leavesAllLightSquaresEmpty() {
        Board board = Board.initial();

        assertThat(board.pieces().keySet())
                .allSatisfy(position -> assertThat(board.isPlayable(position.row(), position.column()))
                        .isTrue());
    }
}
