package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Random;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** Test unitaire pur : le controller est appelé comme un objet Java, sans contexte Spring ni HTTP. */
class SudokuControllerTest {

    private final SudokuController controller =
            new SudokuController(new SudokuGenerator(new Random(1)), new SudokuService());
    private final SudokuGenerator.Puzzle game = new SudokuGenerator(new Random(11)).generate(Difficulty.EASY);

    @Test
    void puzzleReturnsRequestedDifficultyWithFullGrid() {
        SudokuController.PuzzleResponse response = controller.puzzle("medium");

        assertThat(response.difficulty()).isEqualTo("medium");
        assertThat(response.puzzle()).hasSize(SudokuSolver.CELLS);
    }

    @Test
    void puzzleResponseExposesNoSolution() {
        assertThat(SudokuController.PuzzleResponse.class.getRecordComponents())
                .extracting(c -> c.getName())
                .containsExactly("difficulty", "puzzle");
    }

    @Test
    void puzzleRejectsUnknownDifficulty() {
        assertThatThrownBy(() -> controller.puzzle("extreme")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void checkAcceptsSolvedGrid() {
        SudokuService.CheckResult result = controller.check(request(game.solution(), 100, 0));

        assertThat(result.solved()).isTrue();
        // 500 s gagnées : 120 + 240 + 260 x 3 = 1140 ; (1000 + 1140) + 10 % sans faute
        assertThat(result.score()).isEqualTo(2354);
        assertThat(result.breakdown().perfectBonus()).isEqualTo(214);
    }

    @Test
    void checkReportsIncompleteGrid() {
        SudokuService.CheckResult result = controller.check(request(game.puzzle(), 5, 0));

        assertThat(result.complete()).isFalse();
        assertThat(result.solved()).isFalse();
    }

    @Test
    void checkRejectsMalformedGrid() {
        SudokuController.CheckRequest body =
                new SudokuController.CheckRequest("easy", new int[] {1, 2}, new int[] {1, 2}, 0, 0);

        assertThatThrownBy(() -> controller.check(body)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void badRequestHandlerMapsErrorToHttp400WithMessage() {
        var response = controller.handleBadRequest(new IllegalArgumentException("Difficulté inconnue : x"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("error", "Difficulté inconnue : x");
    }

    private SudokuController.CheckRequest request(int[] values, int seconds, int mistakes) {
        return new SudokuController.CheckRequest("easy", game.puzzle(), values, seconds, mistakes);
    }
}
