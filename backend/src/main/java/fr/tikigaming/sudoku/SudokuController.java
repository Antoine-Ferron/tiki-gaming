package fr.tikigaming.sudoku;

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
    PuzzleResponse puzzle(@RequestParam(defaultValue = "easy") String difficulty) {
        Difficulty level = Difficulty.parse(difficulty);
        return new PuzzleResponse(
                level.name().toLowerCase(), generator.generate(level).puzzle());
    }

    @PostMapping("/check")
    SudokuService.CheckResult check(@RequestBody CheckRequest body) {
        return service.check(
                body.puzzle(), body.values(), Difficulty.parse(body.difficulty()), body.seconds(), body.mistakes());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }
}
