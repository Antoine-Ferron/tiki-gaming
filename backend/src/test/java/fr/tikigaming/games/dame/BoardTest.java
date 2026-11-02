package fr.tikigaming.games.dame;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertAll;

import org.junit.jupiter.api.Test;

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
}
