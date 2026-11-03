package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ScoreCalculatorTest {

    @ParameterizedTest(name = "{0} s gagnées -> {1} points")
    @CsvSource({
        "-100, 0", // plus lent que la référence
        "0, 0",
        "59, 0", // juste sous le seuil d'activation
        "60, 60", // seuil atteint : bonus actif, palier 1
        "120, 120", // fin du palier 1
        "121, 122", // premier point du palier 2
        "180, 240", // 120 x 1 + 60 x 2
        "240, 360", // fin du palier 2
        "241, 363", // premier point du palier 3
        "300, 540" // 120 x 1 + 120 x 2 + 60 x 3
    })
    void timeBonusFollowsProgressiveTiersAndActivationThreshold(int savedSeconds, int expected) {
        assertThat(ScoreCalculator.timeBonus(savedSeconds)).isEqualTo(expected);
    }

    @Test
    void noTimeBonusWhenSlowerThanBudget() {
        ScoreBreakdown result = ScoreCalculator.compute(Difficulty.EASY, 700, 1);

        assertThat(result.timeBonus()).isZero();
        assertThat(result.total()).isEqualTo(1000 - 50);
    }

    @Test
    void perfectGameGetsTenPercentOnBasePlusTimeBonus() {
        // 540 s sur EASY (budget 600) : 60 s gagnées -> bonus de temps 60 ; (1000 + 60) x 10 % = 106
        ScoreBreakdown result = ScoreCalculator.compute(Difficulty.EASY, 540, 0);

        assertThat(result.base()).isEqualTo(1000);
        assertThat(result.timeBonus()).isEqualTo(60);
        assertThat(result.perfectBonus()).isEqualTo(106);
        assertThat(result.mistakePenalty()).isZero();
        assertThat(result.total()).isEqualTo(1166);
    }

    @Test
    void anyMistakeLosesPerfectBonusAndCostsPenalty() {
        ScoreBreakdown result = ScoreCalculator.compute(Difficulty.EASY, 540, 2);

        assertThat(result.perfectBonus()).isZero();
        assertThat(result.mistakePenalty()).isEqualTo(100);
        assertThat(result.total()).isEqualTo(1000 + 60 - 100);
    }

    @Test
    void breakdownTotalIsTheSumOfItsParts() {
        ScoreBreakdown r = ScoreCalculator.compute(Difficulty.HARD, 500, 0);

        assertThat(r.total()).isEqualTo(r.base() + r.timeBonus() + r.perfectBonus() - r.mistakePenalty());
    }

    @Test
    void totalNeverDropsBelowMinimum() {
        assertThat(ScoreCalculator.compute(Difficulty.EASY, 100_000, 50).total())
                .isEqualTo(10);
    }

    @Test
    void budgetsGrowWithDifficulty() {
        assertThat(Difficulty.EASY.timeBudgetSeconds()).isLessThan(Difficulty.MEDIUM.timeBudgetSeconds());
        assertThat(Difficulty.MEDIUM.timeBudgetSeconds()).isLessThan(Difficulty.HARD.timeBudgetSeconds());
    }
}
