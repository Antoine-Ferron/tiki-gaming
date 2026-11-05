package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.OptionalInt;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Les niveaux eux-mêmes (maps et minimums) sont vérifiés par ContractTest, avec le contrat partagé avec le jeu. */
class LevelsTest {

    @ParameterizedTest(name = "le niveau {0} n'existe pas")
    @ValueSource(ints = {0, 21, -1})
    void unknownLevelHasNoMap(int number) {
        // Act + Assert
        assertThat(Levels.map(number)).isEmpty();
    }

    @ParameterizedTest(name = "le minimum du niveau {0} est celui du solveur")
    @ValueSource(ints = {1, 2, 10, 19, 20})
    void minimumOfAKnownLevelIsTheSolverOne(int number) {
        // Arrange
        OptionalInt expected =
                Solver.minimumMoves(Board.parse(Levels.map(number).orElseThrow()));

        // Act
        OptionalInt minimum = Levels.minimum(number);

        // Assert
        assertThat(minimum).isEqualTo(expected);
    }

    @ParameterizedTest(name = "le niveau {0} n'a pas de minimum")
    @ValueSource(ints = {0, 21, -1})
    void unknownLevelHasNoMinimum(int number) {
        // Act + Assert
        assertThat(Levels.minimum(number)).isEmpty();
    }
}
