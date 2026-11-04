package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Mêmes cas que frontend/src/games/rush-hour/domain/score.test.ts : les deux calculs ne doivent jamais diverger. */
class ScoringTest {

    private static final int OPTIMAL = 10;

    @ParameterizedTest(name = "{0} coups, {1} indice(s) → {2} points")
    @CsvSource({
        "10, 0, 1000", // parfait
        "11, 0, 950", // 1 coup en trop
        "10, 1, 800", // 1 indice
        "12, 2, 500", // 2 coups en trop et 2 indices
        "29, 0, 50", // valeurs limites autour du plancher
        "30, 0, 0",
        "31, 0, 0",
        "1000, 0, 0",
    })
    void computesLevelScore(int moves, int hints, int expected) {
        // Act
        int score = Scoring.levelScore(moves, OPTIMAL, hints);

        // Assert
        assertThat(score).isEqualTo(expected);
    }

    @ParameterizedTest(name = "refuse {0} coups et {1} indice(s)")
    @CsvSource({
        "9, 0, Nombre de coups impossible : 9 pour un minimum de 10", // moins que le minimum : triche
        "10, -1, Nombre d’indices impossible : -1",
    })
    void rejectsImpossibleGames(int moves, int hints, String message) {
        // Act + Assert
        assertThatThrownBy(() -> Scoring.levelScore(moves, OPTIMAL, hints))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(message);
    }
}
