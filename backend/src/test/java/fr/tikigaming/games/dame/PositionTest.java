package fr.tikigaming.games.dame;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class PositionTest {

    @ParameterizedTest
    @CsvSource({"0, 0", "0, 9", "9, 0", "9, 9", "1, 8", "8, 1", "4, 5"})
    void acceptsCoordinatesInsideTheBoard(int row, int column) {
        Position position = new Position(row, column);

        assertThat(position.row()).isEqualTo(row);
        assertThat(position.column()).isEqualTo(column);
    }

    @ParameterizedTest
    @CsvSource({"-1, 0", "0, -1", "10, 0", "0, 10", "-1, -1", "10, 10", "-2147483648, 5", "5, 2147483647"})
    void rejectsCoordinatesOutsideTheBoard(int row, int column) {
        assertThatThrownBy(() -> new Position(row, column)).isInstanceOf(IllegalArgumentException.class);
    }
}
