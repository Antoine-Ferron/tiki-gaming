package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

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

    @Test
    @DisplayName("la case e4 est en colonne 4 et rangée 3")
    void laCaseE4EstEnColonne4EtRangee3() {
        // Arrange
        String notation = "e4";

        // Act
        Square square = Square.of(notation);

        // Assert
        assertThat(square.file()).isEqualTo(4);
        assertThat(square.rank()).isEqualTo(3);
    }

    @ParameterizedTest(name = "{0} est refusée")
    @ValueSource(strings = {"i1", "a9", "a0"})
    @DisplayName("une case hors de l'échiquier est refusée (juste après h, après 8, avant 1)")
    void uneCaseHorsDeLEchiquierEstRefusee(String notation) {
        // Act + Assert
        assertThatThrownBy(() -> Square.of(notation)).isInstanceOf(IllegalArgumentException.class);
    }
}
