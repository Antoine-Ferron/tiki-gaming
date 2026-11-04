package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;

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
}
