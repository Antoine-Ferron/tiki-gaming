package fr.tikigaming.games.sudoku;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Objects;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/sudoku")
@Tag(name = "sudoku", description = "Génération de grilles et vérification d'une partie de sudoku.")
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

    /** État d'une partie en cours, sans la solution. */
    record GameState(String gameId, String difficulty, int[] puzzle, int[] values, int mistakes, int seconds) {

        @Override
        public boolean equals(Object other) {
            return other instanceof GameState that
                    && Objects.equals(gameId, that.gameId)
                    && Objects.equals(difficulty, that.difficulty)
                    && Arrays.equals(puzzle, that.puzzle)
                    && Arrays.equals(values, that.values)
                    && mistakes == that.mistakes
                    && seconds == that.seconds;
        }

        @Override
        public int hashCode() {
            return Objects.hash(
                    gameId, difficulty, Arrays.hashCode(puzzle), Arrays.hashCode(values), mistakes, seconds);
        }

        @Override
        public String toString() {
            return "GameState[gameId=" + gameId + ", difficulty=" + difficulty + ", puzzle=" + Arrays.toString(puzzle)
                    + ", values=" + Arrays.toString(values) + ", mistakes=" + mistakes + ", seconds=" + seconds + "]";
        }
    }

    /** Saisie d'un chiffre dans une case (0 à 80, ligne par ligne). */
    record MoveRequest(int cell, int value) {}

    /** Ne porte que l'id : grille, difficulté, temps et erreurs sont ceux que le serveur a lui-même enregistrés. */
    record CheckRequest(String gameId) {}

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
            HttpServletRequest request,
            @Parameter(description = "easy, medium ou hard", example = "medium") @RequestParam(defaultValue = "easy")
                    String difficulty) {
        Difficulty level = Difficulty.parse(difficulty);
        SudokuGenerator.Puzzle grids = generator.generate(level);
        GameStore.Game game = games.start(request.getRemoteAddr(), level, grids);
        return new PuzzleResponse(game.id(), level.name().toLowerCase(), game.puzzle());
    }

    @GetMapping("/{gameId}")
    @Operation(
            summary = "Reprendre une partie",
            description = "État d'une partie en cours : grille de départ, grille du joueur, erreurs et temps écoulé."
                    + " La solution n'est jamais renvoyée.")
    @ApiResponse(responseCode = "200", description = "État de la partie")
    @ApiResponse(responseCode = "400", description = "Partie inconnue, expirée ou déjà résolue")
    GameState state(@PathVariable String gameId) {
        GameStore.Game game = games.find(gameId);
        return new GameState(
                game.id(),
                game.difficulty().name().toLowerCase(),
                game.puzzle(),
                game.values(),
                game.mistakes(),
                game.elapsedSeconds());
    }

    @PostMapping("/{gameId}/moves")
    @Operation(
            summary = "Saisir un chiffre",
            description = "Le serveur compare la saisie à la solution : une saisie fausse coûte une erreur et n'entre"
                    + " pas dans la grille. Les erreurs du score viennent d'ici, jamais du client.")
    @ApiResponse(responseCode = "200", description = "Saisie correcte ou non, erreurs cumulées, grille complète")
    @ApiResponse(responseCode = "400", description = "Partie inconnue ou expirée, case ou chiffre invalide")
    GameStore.MoveResult move(@PathVariable String gameId, @RequestBody MoveRequest body) {
        return games.find(gameId).play(body.cell(), body.value());
    }

    @PostMapping("/check")
    @Operation(
            summary = "Vérifier une partie",
            description =
                    "Contrôle la grille du joueur pour la partie `gameId` (complète, sans conflit, indices intacts)"
                            + " et calcule le score. Grille, difficulté et temps sont ceux du serveur ; une partie résolue"
                            + " est close.")
    @ApiResponse(responseCode = "200", description = "Résultat de la vérification")
    @ApiResponse(responseCode = "400", description = "Partie inconnue, expirée ou déjà résolue")
    SudokuService.CheckResult check(@RequestBody CheckRequest body) {
        GameStore.Game game = games.find(body.gameId());
        SudokuService.CheckResult result =
                service.check(game.puzzle(), game.values(), game.difficulty(), game.elapsedSeconds(), game.mistakes());
        if (result.solved()) games.finish(game.id());
        return result;
    }
}
