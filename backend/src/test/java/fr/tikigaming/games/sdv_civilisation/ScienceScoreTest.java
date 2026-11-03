package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ScienceScoreTest {

    @Test
    void addsSquaresAndSevenPointsPerCompleteSet() {
        // 3² + 2² + 1² + 7 (exemple de la spécification)
        assertThat(ScienceScore.compute(3, 2, 1)).isEqualTo(21);
    }

    @Test
    void rejectsNegativeCounts() {
        assertThatThrownBy(() -> ScienceScore.compute(0, 0, -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Un nombre de symboles ne peut pas être négatif");
    }
}
