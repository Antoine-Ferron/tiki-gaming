package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class LevelsTest {

    /**
     * Minimum de coups de chaque niveau, de 1 à 20. Même liste que frontend/src/games/rush-hour/domain/levels.test.ts :
     * si un niveau change d'un seul côté, l'une des deux suites échoue.
     */
    static final List<Integer> MINIMUMS =
            List.of(3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 22, 24, 26);

    @Test
    void serverKnowsTheSameTwentyLevelsAsTheGame() {
        // Act
        List<Integer> minimums = IntStream.rangeClosed(1, 20)
                .mapToObj(n -> Solver.minimumMoves(Board.parse(Levels.map(n).orElseThrow()))
                        .orElseThrow())
                .toList();

        // Assert
        assertThat(minimums).isEqualTo(MINIMUMS);
    }

    @ParameterizedTest(name = "le niveau {0} n'existe pas")
    @ValueSource(ints = {0, 21, -1})
    void unknownLevelHasNoMap(int number) {
        // Act + Assert
        assertThat(Levels.map(number)).isEmpty();
    }
}
