package fr.tikigaming.sudoku;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Arrays;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sudoku")
@Tag(name = "Sudoku", description = "Génération de grilles et vérification d'une partie de sudoku.")
public class SudokuController {

    /** Un record ne compare pas le contenu d'un tableau : equals, hashCode et toString le font à la main. */
    record PuzzleResponse(String gameId, String difficulty, int[] puzzle) {

        @Override
        public boolean equals(Object other) {
            return other instanceof PuzzleResponse that
                    && Objects.equals(gameId, that.gameId)
                    && Objects.equals(difficulty, that.difficulty)
                    && Arrays.equals(puzzle, that.puzzle);
        }

        @Override
        public int hashCode() {
            return Objects.hash(gameId, difficulty, Arrays.hashCode(puzzle));
        }

        @Override
        public String toString() {
            return "PuzzleResponse[gameId=" + gameId + ", difficulty=" + difficulty + ", puzzle="
                    + Arrays.toString(puzzle) + "]";
        }
    }

    /** Grille, difficulté et temps ne viennent pas du client : seul l'id de partie les désigne côté serveur. */
    record CheckRequest(String gameId, int[] values, int mistakes) {

        @Override
        public boolean equals(Object other) {
            return other instanceof CheckRequest that
                    && Objects.equals(gameId, that.gameId)
                    && Arrays.equals(values, that.values)
                    && mistakes == that.mistakes;
        }

        @Override
        public int hashCode() {
            return Objects.hash(gameId, Arrays.hashCode(values), mistakes);
        }

        @Override
        public String toString() {
            return "CheckRequest[gameId=" + gameId + ", values=" + Arrays.toString(values) + ", mistakes=" + mistakes
                    + "]";
        }
    }

    private final SudokuGenerator generator;
    private final SudokuService service;
    private final GameStore games;

    public SudokuController(SudokuGenerator generator, SudokuService service, GameStore games) {
        this.generator = generator;
        this.service = service;
        this.games = games;
    }

    /** Nouvelle grille. La solution n'est jamais renvoyée au client. */
    @GetMapping("/puzzle")
    @Operation(
            summary = "Générer une grille",
            description =
                    "Renvoie une grille à solution unique (0 = case vide) et l'id de la partie, gardée côté serveur"
                            + " avec son heure de début. La solution n'est jamais renvoyée.")
    @ApiResponse(responseCode = "200", description = "Grille de 81 cases")
    @ApiResponse(responseCode = "400", description = "Difficulté inconnue")
    PuzzleResponse puzzle(
            @Parameter(description = "easy, medium ou hard", example = "medium") @RequestParam(defaultValue = "easy")
                    String difficulty) {
        Difficulty level = Difficulty.parse(difficulty);
        SudokuGenerator.Puzzle grids = generator.generate(level);
        GameStore.Game game = games.start(level, grids);
        return new PuzzleResponse(game.id(), level.name().toLowerCase(), game.puzzle());
    }

    @PostMapping("/check")
    @Operation(
            summary = "Vérifier une partie",
            description =
                    "Contrôle la grille du joueur pour la partie `gameId` (complète, sans conflit, indices intacts)"
                            + " et calcule le score. Grille, difficulté et temps sont ceux du serveur ; une partie résolue"
                            + " est close.")
    @ApiResponse(responseCode = "200", description = "Résultat de la vérification")
    @ApiResponse(responseCode = "400", description = "Partie inconnue, expirée ou déjà résolue ; grille mal formée")
    SudokuService.CheckResult check(@RequestBody CheckRequest body) {
        GameStore.Game game = games.find(body.gameId());
        SudokuService.CheckResult result =
                service.check(game.puzzle(), body.values(), game.difficulty(), game.elapsedSeconds(), body.mistakes());
        if (result.solved()) games.finish(game.id());
        return result;
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String, String>> handleTooManyGames(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }
}
