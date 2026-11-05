package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

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

    @ParameterizedTest(name = "tablettes {0}, roues {1}, compas {2}")
    @CsvSource({"-1, 0, 0", "0, -1, 0", "0, 0, -1"})
    void rejectsANegativeCountOfAnySymbol(int tablets, int gears, int compasses) {
        // Quand un des trois symboles est compté négatif (valeur limite : -1)
        // Alors le calcul est refusé
        assertThatThrownBy(() -> ScienceScore.compute(tablets, gears, compasses))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Un nombre de symboles ne peut pas être négatif");
    }

    @Test
    void acceptsZeroOfEachSymbol() {
        // Quand aucun symbole n'est construit (valeur limite : 0)
        // Alors la science ne rapporte rien, sans erreur
        assertThat(ScienceScore.compute(0, 0, 0)).isZero();
    }
}
