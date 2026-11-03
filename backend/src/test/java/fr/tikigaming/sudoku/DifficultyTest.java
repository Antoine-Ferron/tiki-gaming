package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

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

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void treatsBlankValueAsMissing(String blank) {
        assertThatThrownBy(() -> Difficulty.parse(blank))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Difficulté manquante");
    }
}
