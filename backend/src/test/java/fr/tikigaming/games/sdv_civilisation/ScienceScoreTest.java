package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ScienceScoreTest {

    @Test
    void scoresZeroWithoutSymbols() {
        assertThat(ScienceScore.compute(0, 0, 0)).isZero();
    }

    @Test
    void scoresTheSquareOfIdenticalSymbols() {
        assertThat(ScienceScore.compute(2, 0, 0)).isEqualTo(4);
        assertThat(ScienceScore.compute(0, 3, 0)).isEqualTo(9);
    }

    @Test
    void addsSevenPointsForOneCompleteSet() {
        // 1² + 1² + 1² + 7
        assertThat(ScienceScore.compute(1, 1, 1)).isEqualTo(10);
    }

    // tablettes, roues, compas, points attendus (3, 2, 1 est l'exemple de la spécification)
    @ParameterizedTest
    @CsvSource({"3, 2, 1, 21", "2, 2, 2, 26", "4, 0, 4, 32"})
    void scoresMixedCombinations(int tablets, int gears, int compasses, int expected) {
        assertThat(ScienceScore.compute(tablets, gears, compasses)).isEqualTo(expected);
    }

    @Test
    void rejectsNegativeCounts() {
        assertThatThrownBy(() -> ScienceScore.compute(-1, 0, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Un nombre de symboles ne peut pas être négatif");
    }
}
