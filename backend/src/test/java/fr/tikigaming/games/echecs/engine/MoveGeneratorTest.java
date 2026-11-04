package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MoveGeneratorTest {

    @Test
    @DisplayName("un cavalier au centre (d4) a 8 cases possibles (règle D6)")
    void unCavalierAuCentreA8Cases() {
        // Arrange
        Position position = Fen.parse("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");

        // Act
        Set<Square> destinations = MoveGenerator.destinations(position, Square.of("d4"));

        // Assert
        assertThat(destinations).isEqualTo(squares("b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"));
    }

    private static Set<Square> squares(String... notations) {
        return Arrays.stream(notations).map(Square::of).collect(Collectors.toSet());
    }
}
