package fr.tikigaming.games.yams;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class YamsScoreTest {

    @Test
    void addsUpperAndLowerSections() {
        assertThat(YamsScore.total(40, 100)).isEqualTo(140);
    }

    @Test
    void addsTheBonusFromSixtyThree() {
        assertThat(YamsScore.total(62, 0)).isEqualTo(62);
        assertThat(YamsScore.total(63, 0)).isEqualTo(63 + 35);
    }

    @Test
    void rejectsNegativeSubtotals() {
        assertThatThrownBy(() -> YamsScore.total(-1, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Un sous-total ne peut pas être négatif");
    }
}
