package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SquareTest {

    @Test
    @DisplayName("la case a1 est en colonne 0 et rangée 0")
    void laCaseA1EstEnColonne0EtRangee0() {
        // Arrange
        String notation = "a1";

        // Act
        Square square = Square.of(notation);

        // Assert
        assertThat(square.file()).isEqualTo(0);
        assertThat(square.rank()).isEqualTo(0);
    }

    @Test
    @DisplayName("la case h8 est en colonne 7 et rangée 7")
    void laCaseH8EstEnColonne7EtRangee7() {
        // Arrange
        String notation = "h8";

        // Act
        Square square = Square.of(notation);

        // Assert
        assertThat(square.file()).isEqualTo(7);
        assertThat(square.rank()).isEqualTo(7);
    }
}
