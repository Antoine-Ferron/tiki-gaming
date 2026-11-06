package fr.tikigaming.games.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

/** Test unitaire pur : le controller est appelé comme un objet Java, sans contexte Spring ni HTTP. */
class SudokuControllerTest {

    private static final Instant START = Instant.parse("2026-11-03T10:00:00Z");

    private final FixedClock clock = new FixedClock(START);
    private final SudokuController controller =
            new SudokuController(new SudokuGenerator(new Random(1)), new SudokuService(), new GameStore(clock));

    @Test
    void puzzleReturnsRequestedDifficultyWithFullGrid() {
        SudokuController.PuzzleResponse response = puzzle("medium");

        assertThat(response.difficulty()).isEqualTo("medium");
        assertThat(response.puzzle()).hasSize(SudokuSolver.CELLS);
    }

    @Test
    void puzzleResponseExposesNoSolution() {
        assertThat(SudokuController.PuzzleResponse.class.getRecordComponents())
                .extracting(c -> c.getName())
                .containsExactly("gameId", "difficulty", "puzzle");
    }

    @Test
    void puzzleRejectsUnknownDifficulty() {
        assertThatThrownBy(() -> puzzle("extreme")).isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void checkScoresServerBuiltGridWithServerSideTime() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        playSolution(game);
        clock.advance(Duration.ofSeconds(100));

        SudokuService.CheckResult result = controller.check(new SudokuController.CheckRequest(game.gameId()));

        assertThat(result.solved()).isTrue();
        // 100 s jouées : 500 s gagnées, 120 + 240 + 260 x 3 = 1140 ; (1000 + 1140) + 10 % sans faute
        assertThat(result.score()).isEqualTo(2354);
        assertThat(result.breakdown().perfectBonus()).isEqualTo(214);
    }

    @Test
    void checkCannotClaimBestScoreByLyingAboutTime() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        playSolution(game);
        clock.advance(Duration.ofSeconds(590));

        SudokuService.CheckResult result = controller.check(new SudokuController.CheckRequest(game.gameId()));

        // le temps vient de l'horloge du serveur : 590 s jouées, 10 s gagnées, sous le seuil de 60 s
        assertThat(result.breakdown().timeBonus()).isZero();
    }

    @Test
    void wrongMovesCostMistakesAndRemoveTheNoMistakeBonus() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        int cell = firstEmptyCell(game);
        int wrong = solve(game.puzzle())[cell] % 9 + 1;

        GameStore.MoveResult miss = controller.move(game.gameId(), new SudokuController.MoveRequest(cell, wrong));
        controller.move(game.gameId(), new SudokuController.MoveRequest(cell, wrong));
        playSolution(game);
        SudokuService.CheckResult result = controller.check(new SudokuController.CheckRequest(game.gameId()));

        assertThat(miss.correct()).isFalse();
        assertThat(miss.mistakes()).isEqualTo(1);
        assertThat(result.solved()).isTrue();
        assertThat(result.breakdown().perfectBonus()).isZero();
        assertThat(result.breakdown().mistakePenalty()).isEqualTo(100);
    }

    @Test
    void checkWithoutMovesCannotBeSolvedNorGetNoMistakeBonus() {
        SudokuController.PuzzleResponse game = puzzle("hard");

        SudokuService.CheckResult result = controller.check(new SudokuController.CheckRequest(game.gameId()));

        assertThat(result.complete()).isFalse();
        assertThat(result.score()).isZero();
    }

    @Test
    void moveReportsCompletionOnLastCorrectCell() {
        SudokuController.PuzzleResponse game = puzzle("easy");

        GameStore.MoveResult last = playSolution(game);

        assertThat(last.correct()).isTrue();
        assertThat(last.complete()).isTrue();
        assertThat(last.mistakes()).isZero();
    }

    @Test
    void moveRejectsInvalidCellValueAndStartingClue() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        int clue = firstClueCell(game);

        assertThatThrownBy(() -> controller.move(game.gameId(), new SudokuController.MoveRequest(-1, 5)))
                .isInstanceOf(SudokuBadRequestException.class);
        assertThatThrownBy(() -> controller.move(game.gameId(), new SudokuController.MoveRequest(81, 5)))
                .isInstanceOf(SudokuBadRequestException.class);
        assertThatThrownBy(() -> controller.move(game.gameId(), new SudokuController.MoveRequest(0, 0)))
                .isInstanceOf(SudokuBadRequestException.class);
        assertThatThrownBy(() -> controller.move(game.gameId(), new SudokuController.MoveRequest(0, 10)))
                .isInstanceOf(SudokuBadRequestException.class);
        assertThatThrownBy(() -> controller.move(game.gameId(), new SudokuController.MoveRequest(clue, 5)))
                .isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void moveRejectsUnknownGameId() {
        assertThatThrownBy(() -> controller.move("inconnu", new SudokuController.MoveRequest(0, 1)))
                .isInstanceOf(SudokuBadRequestException.class)
                .hasMessage("Partie inconnue ou expirée");
    }

    @Test
    void checkRejectsUnknownAndMissingGameId() {
        assertThatThrownBy(() -> controller.check(new SudokuController.CheckRequest("inconnu")))
                .isInstanceOf(SudokuBadRequestException.class)
                .hasMessage("Partie inconnue ou expirée");
        assertThatThrownBy(() -> controller.check(new SudokuController.CheckRequest(null)))
                .isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void solvedGameCannotBeScoredTwice() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        playSolution(game);
        SudokuController.CheckRequest body = new SudokuController.CheckRequest(game.gameId());
        controller.check(body);

        assertThatThrownBy(() -> controller.check(body)).isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void incompleteGameStaysOpen() {
        SudokuController.PuzzleResponse game = puzzle("easy");

        SudokuService.CheckResult early = controller.check(new SudokuController.CheckRequest(game.gameId()));
        playSolution(game);
        SudokuService.CheckResult done = controller.check(new SudokuController.CheckRequest(game.gameId()));

        assertThat(early.complete()).isFalse();
        assertThat(done.solved()).isTrue();
    }

    @Test
    void badRequestExceptionCarriesHttp400AndPlayerMessage() {
        SudokuBadRequestException e = new SudokuBadRequestException("Difficulté inconnue : x");

        assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(e).hasMessage("Difficulté inconnue : x");
    }

    @Test
    void stateReturnsGridMistakesAndTimeWithoutSolution() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        int cell = firstEmptyCell(game);
        int solution = solve(game.puzzle())[cell];
        controller.move(game.gameId(), new SudokuController.MoveRequest(cell, solution % 9 + 1));
        controller.move(game.gameId(), new SudokuController.MoveRequest(cell, solution));
        clock.advance(Duration.ofSeconds(42));

        SudokuController.GameState state = controller.state(game.gameId());

        assertThat(SudokuController.GameState.class.getRecordComponents())
                .extracting(c -> c.getName())
                .containsExactly(
                        "gameId", "difficulty", "puzzle", "values", "mistakes", "maxMistakes", "lost", "seconds");
        assertThat(state.puzzle()).isEqualTo(game.puzzle());
        assertThat(state.values()[cell]).isEqualTo(solution);
        assertThat(state.mistakes()).isEqualTo(1);
        assertThat(state.maxMistakes()).isEqualTo(3);
        assertThat(state.lost()).isFalse();
        assertThat(state.seconds()).isEqualTo(42);
        assertThat(state.difficulty()).isEqualTo("easy");
    }

    @Test
    void stateRejectsUnknownGameId() {
        assertThatThrownBy(() -> controller.state("inconnu")).isInstanceOf(SudokuBadRequestException.class);
    }

    @Test
    void gameStateComparesGridContentNotArrayIdentity() {
        SudokuController.GameState a = state("g", "easy", new int[] {1}, new int[] {2}, 1, 3, false, 5);

        assertThat(a)
                .isEqualTo(state("g", "easy", new int[] {1}, new int[] {2}, 1, 3, false, 5))
                .hasSameHashCodeAs(state("g", "easy", new int[] {1}, new int[] {2}, 1, 3, false, 5));
        assertThat(a)
                .isNotEqualTo(state("h", "easy", new int[] {1}, new int[] {2}, 1, 3, false, 5))
                .isNotEqualTo(state("g", "hard", new int[] {1}, new int[] {2}, 1, 3, false, 5))
                .isNotEqualTo(state("g", "easy", new int[] {9}, new int[] {2}, 1, 3, false, 5))
                .isNotEqualTo(state("g", "easy", new int[] {1}, new int[] {9}, 1, 3, false, 5))
                .isNotEqualTo(state("g", "easy", new int[] {1}, new int[] {2}, 2, 3, false, 5))
                .isNotEqualTo(state("g", "easy", new int[] {1}, new int[] {2}, 1, 4, false, 5))
                .isNotEqualTo(state("g", "easy", new int[] {1}, new int[] {2}, 1, 3, true, 5))
                .isNotEqualTo(state("g", "easy", new int[] {1}, new int[] {2}, 1, 3, false, 6));
        assertThat(a.toString())
                .contains("g")
                .contains("easy")
                .contains("[1]")
                .contains("[2]")
                .contains("lost=false");
    }

    private static SudokuController.GameState state(
            String id,
            String difficulty,
            int[] puzzle,
            int[] values,
            int mistakes,
            int max,
            boolean lost,
            int seconds) {
        return new SudokuController.GameState(id, difficulty, puzzle, values, mistakes, max, lost, seconds);
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
    void threeMistakesAreAllowedAndTheFourthLosesTheGame() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        int cell = firstEmptyCell(game);
        int wrong = solve(game.puzzle())[cell] % 9 + 1;

        GameStore.MoveResult third = null;
        for (int i = 0; i < GameStore.MAX_MISTAKES; i++) {
            third = controller.move(game.gameId(), new SudokuController.MoveRequest(cell, wrong));
        }
        GameStore.MoveResult fourth = controller.move(game.gameId(), new SudokuController.MoveRequest(cell, wrong));

        assertThat(third.mistakes()).isEqualTo(3);
        assertThat(third.lost()).isFalse();
        assertThat(fourth.mistakes()).isEqualTo(4);
        assertThat(fourth.lost()).isTrue();
    }

    @Test
    void aLostGameRefusesFurtherMovesEvenCorrectOnes() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        int cell = firstEmptyCell(game);
        int solution = solve(game.puzzle())[cell];
        loseTheGame(game, cell, solution % 9 + 1);

        assertThatThrownBy(() -> controller.move(game.gameId(), new SudokuController.MoveRequest(cell, solution)))
                .isInstanceOfSatisfying(
                        SudokuGameOverException.class,
                        e -> assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void aLostGameCannotBeCheckedNorScored() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        loseTheGame(game, firstEmptyCell(game), solve(game.puzzle())[firstEmptyCell(game)] % 9 + 1);

        assertThatThrownBy(() -> controller.check(new SudokuController.CheckRequest(game.gameId())))
                .isInstanceOfSatisfying(
                        SudokuGameOverException.class,
                        e -> assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void stateReportsALostGameSoThePlayerCanResumeOnTheEndScreen() {
        SudokuController.PuzzleResponse game = puzzle("easy");
        loseTheGame(game, firstEmptyCell(game), solve(game.puzzle())[firstEmptyCell(game)] % 9 + 1);

        SudokuController.GameState state = controller.state(game.gameId());

        assertThat(state.lost()).isTrue();
        assertThat(state.mistakes()).isEqualTo(GameStore.MAX_MISTAKES + 1);
    }

    private void loseTheGame(SudokuController.PuzzleResponse game, int cell, int wrong) {
        for (int i = 0; i <= GameStore.MAX_MISTAKES; i++) {
            controller.move(game.gameId(), new SudokuController.MoveRequest(cell, wrong));
        }
    }

    private SudokuController.PuzzleResponse puzzle(String difficulty) {
        return controller.puzzle(new MockHttpServletRequest(), difficulty);
    }

    /** Joue toutes les cases vides avec la bonne valeur ; renvoie le résultat de la dernière saisie. */
    private GameStore.MoveResult playSolution(SudokuController.PuzzleResponse game) {
        int[] solution = solve(game.puzzle());
        GameStore.MoveResult last = null;
        for (int cell = 0; cell < SudokuSolver.CELLS; cell++) {
            if (game.puzzle()[cell] == 0) {
                last = controller.move(game.gameId(), new SudokuController.MoveRequest(cell, solution[cell]));
            }
        }
        return last;
    }

    /** Une grille à solution unique : un solveur retrouve la solution gardée par le serveur. */
    private static int[] solve(int[] puzzle) {
        int[] grid = puzzle.clone();
        SudokuSolver.solve(grid, new Random(0));
        return grid;
    }

    private static int firstEmptyCell(SudokuController.PuzzleResponse game) {
        for (int i = 0; i < SudokuSolver.CELLS; i++) {
            if (game.puzzle()[i] == 0) {
                return i;
            }
        }
        throw new IllegalStateException("grille pleine");
    }

    private static int firstClueCell(SudokuController.PuzzleResponse game) {
        for (int i = 0; i < SudokuSolver.CELLS; i++) {
            if (game.puzzle()[i] != 0) {
                return i;
            }
        }
        throw new IllegalStateException("grille vide");
    }
}
