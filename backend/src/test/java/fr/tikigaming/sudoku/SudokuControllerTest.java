package fr.tikigaming.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** Test unitaire pur : le controller est appelé comme un objet Java, sans contexte Spring ni HTTP. */
class SudokuControllerTest {

    private static final Instant START = Instant.parse("2026-11-03T10:00:00Z");

    private final FixedClock clock = new FixedClock(START);
    private final SudokuController controller =
            new SudokuController(new SudokuGenerator(new Random(1)), new SudokuService(), new GameStore(clock));

    @Test
    void puzzleReturnsRequestedDifficultyWithFullGrid() {
        SudokuController.PuzzleResponse response = controller.puzzle("medium");

        assertThat(response.difficulty()).isEqualTo("medium");
        assertThat(response.puzzle()).hasSize(SudokuSolver.CELLS);
    }

    @Test
    void puzzleRejectsUnknownDifficulty() {
        assertThatThrownBy(() -> controller.puzzle("extreme")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void puzzleResponseExposesNoSolution() {
        assertThat(SudokuController.PuzzleResponse.class.getRecordComponents())
                .extracting(c -> c.getName())
                .containsExactly("gameId", "difficulty", "puzzle");
    }

    @Test
    void checkScoresSolvedGridWithServerSideTime() {
        SudokuController.PuzzleResponse game = controller.puzzle("easy");
        clock.advance(Duration.ofSeconds(100));

        SudokuService.CheckResult result =
                controller.check(new SudokuController.CheckRequest(game.gameId(), solve(game.puzzle()), 0));

        assertThat(result.solved()).isTrue();
        // 100 s jouées : 500 s gagnées, 120 + 240 + 260 x 3 = 1140 ; (1000 + 1140) + 10 % sans faute
        assertThat(result.score()).isEqualTo(2354);
        assertThat(result.breakdown().perfectBonus()).isEqualTo(214);
    }

    @Test
    void checkCannotClaimBestScoreByLyingAboutTime() {
        SudokuController.PuzzleResponse game = controller.puzzle("easy");
        clock.advance(Duration.ofSeconds(590));

        SudokuService.CheckResult result =
                controller.check(new SudokuController.CheckRequest(game.gameId(), solve(game.puzzle()), 0));

        // le temps vient de l'horloge du serveur : 590 s jouées, 10 s gagnées, sous le seuil de 60 s
        assertThat(result.breakdown().timeBonus()).isZero();
    }

    @Test
    void checkRejectsGridNotMatchingServerPuzzle() {
        SudokuController.PuzzleResponse game = controller.puzzle("hard");
        int[] foreign = solve(controller.puzzle("hard").puzzle());
        SudokuController.CheckRequest body = new SudokuController.CheckRequest(game.gameId(), foreign, 0);

        // une grille résolue d'une autre partie contredit les indices de départ gardés par le serveur
        assertThatThrownBy(() -> controller.check(body)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void checkRejectsUnknownGameId() {
        SudokuController.CheckRequest body = new SudokuController.CheckRequest("inconnu", new int[81], 0);

        assertThatThrownBy(() -> controller.check(body))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Partie inconnue ou expirée");
    }

    @Test
    void checkRejectsMissingGameId() {
        SudokuController.CheckRequest body = new SudokuController.CheckRequest(null, new int[81], 0);

        assertThatThrownBy(() -> controller.check(body)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void solvedGameCannotBeScoredTwice() {
        SudokuController.PuzzleResponse game = controller.puzzle("easy");
        SudokuController.CheckRequest body = new SudokuController.CheckRequest(game.gameId(), solve(game.puzzle()), 0);
        controller.check(body);

        assertThatThrownBy(() -> controller.check(body)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void incompleteGridKeepsGameOpen() {
        SudokuController.PuzzleResponse game = controller.puzzle("easy");

        SudokuService.CheckResult result =
                controller.check(new SudokuController.CheckRequest(game.gameId(), game.puzzle(), 0));

        assertThat(result.complete()).isFalse();
        assertThat(controller
                        .check(new SudokuController.CheckRequest(game.gameId(), solve(game.puzzle()), 0))
                        .solved())
                .isTrue();
    }

    @Test
    void checkRejectsMalformedGrid() {
        SudokuController.PuzzleResponse game = controller.puzzle("easy");
        SudokuController.CheckRequest body = new SudokuController.CheckRequest(game.gameId(), new int[] {1, 2}, 0);

        assertThatThrownBy(() -> controller.check(body)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void tooManyGamesMapsToHttp503() {
        var response = controller.handleTooManyGames(new IllegalStateException("Trop de parties"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).containsEntry("error", "Trop de parties");
    }

    @Test
    void badRequestHandlerMapsErrorToHttp400WithMessage() {
        var response = controller.handleBadRequest(new IllegalArgumentException("Difficulté inconnue : x"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("error", "Difficulté inconnue : x");
    }

    /** Résout la grille comme le ferait un joueur : seul un solveur connaît la solution côté test. */
    private static int[] solve(int[] puzzle) {
        int[] grid = puzzle.clone();
        SudokuSolver.solve(grid, new Random(0));
        return grid;
    }

    @Test
    void puzzleResponseComparesGridContentNotArrayIdentity() {
        SudokuController.PuzzleResponse a = new SudokuController.PuzzleResponse("g", "easy", new int[] {1, 2, 3});
        SudokuController.PuzzleResponse same = new SudokuController.PuzzleResponse("g", "easy", new int[] {1, 2, 3});

        assertThat(a).isEqualTo(same).hasSameHashCodeAs(same);
        assertThat(a)
                .isNotEqualTo(new SudokuController.PuzzleResponse("g", "easy", new int[] {1, 2, 4}))
                .isNotEqualTo(new SudokuController.PuzzleResponse("g", "hard", new int[] {1, 2, 3}))
                .isNotEqualTo(new SudokuController.PuzzleResponse("h", "easy", new int[] {1, 2, 3}));
        assertThat(a.toString()).contains("g").contains("easy").contains("[1, 2, 3]");
    }

    @Test
    void checkRequestComparesGridContentNotArrayIdentity() {
        SudokuController.CheckRequest a = new SudokuController.CheckRequest("g", new int[] {2}, 1);
        SudokuController.CheckRequest same = new SudokuController.CheckRequest("g", new int[] {2}, 1);

        assertThat(a).isEqualTo(same).hasSameHashCodeAs(same);
        assertThat(a)
                .isNotEqualTo(new SudokuController.CheckRequest("h", new int[] {2}, 1))
                .isNotEqualTo(new SudokuController.CheckRequest("g", new int[] {9}, 1))
                .isNotEqualTo(new SudokuController.CheckRequest("g", new int[] {2}, 2));
        assertThat(a.toString()).contains("g").contains("[2]");
    }
}
