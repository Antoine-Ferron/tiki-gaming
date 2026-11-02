package fr.tikigaming.sudoku;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
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

    record PuzzleResponse(String difficulty, int[] puzzle) {}

    record CheckRequest(String difficulty, int[] puzzle, int[] values, int seconds, int mistakes) {}

    private final SudokuGenerator generator;
    private final SudokuService service;

    public SudokuController(SudokuGenerator generator, SudokuService service) {
        this.generator = generator;
        this.service = service;
    }

    /** Nouvelle grille. La solution n'est jamais renvoyée au client. */
    @GetMapping("/puzzle")
    @Operation(
            summary = "Générer une grille",
            description = "Renvoie une grille à solution unique (0 = case vide). La solution n'est jamais renvoyée.")
    @ApiResponse(responseCode = "200", description = "Grille de 81 cases")
    @ApiResponse(responseCode = "400", description = "Difficulté inconnue")
    PuzzleResponse puzzle(
            @Parameter(description = "easy, medium ou hard", example = "medium") @RequestParam(defaultValue = "easy")
                    String difficulty) {
        Difficulty level = Difficulty.parse(difficulty);
        return new PuzzleResponse(
                level.name().toLowerCase(), generator.generate(level).puzzle());
    }

    @PostMapping("/check")
    @Operation(
            summary = "Vérifier une partie",
            description = "Contrôle la grille du joueur (complète, sans conflit, indices intacts) et calcule le score.")
    @ApiResponse(responseCode = "200", description = "Résultat de la vérification")
    @ApiResponse(responseCode = "400", description = "Grille mal formée ou indice de départ modifié")
    SudokuService.CheckResult check(@RequestBody CheckRequest body) {
        return service.check(
                body.puzzle(), body.values(), Difficulty.parse(body.difficulty()), body.seconds(), body.mistakes());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }
}
