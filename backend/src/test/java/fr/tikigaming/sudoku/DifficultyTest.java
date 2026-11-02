package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class DifficultyTest {

    @Test
    void parsesLowerCaseAndTrimmedValues() {
        assertThat(Difficulty.parse("easy")).isEqualTo(Difficulty.EASY);
        assertThat(Difficulty.parse(" Hard ")).isEqualTo(Difficulty.HARD);
    }

    @Test
    void rejectsUnknownOrMissingValue() {
        assertThatThrownBy(() -> Difficulty.parse("extreme")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Difficulty.parse(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void exposesBaseScores() {
        assertThat(Difficulty.EASY.baseScore()).isEqualTo(1000);
        assertThat(Difficulty.MEDIUM.baseScore()).isEqualTo(2000);
        assertThat(Difficulty.HARD.baseScore()).isEqualTo(3000);
    }
}
