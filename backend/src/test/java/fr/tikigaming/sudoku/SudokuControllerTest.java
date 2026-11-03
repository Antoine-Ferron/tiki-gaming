package fr.tikigaming.sudoku;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import java.util.Arrays;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

class SudokuControllerTest {

    private MockMvc mvc;
    private final SudokuGenerator.Puzzle game = new SudokuGenerator(new Random(11)).generate(Difficulty.EASY);

    @BeforeEach
    void setUp() {
        mvc = standaloneSetup(new SudokuController(new SudokuGenerator(new Random(1)), new SudokuService()))
                .build();
    }

    @Test
    void puzzleReturnsGridWithoutSolution() throws Exception {
        mvc.perform(get("/api/sudoku/puzzle").param("difficulty", "medium"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.difficulty").value("medium"))
                .andExpect(jsonPath("$.puzzle", hasSize(81)))
                .andExpect(jsonPath("$.solution").doesNotExist());
    }

    @Test
    void puzzleDefaultsToEasy() throws Exception {
        mvc.perform(get("/api/sudoku/puzzle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.difficulty").value("easy"));
    }

    @Test
    void puzzleRejectsUnknownDifficulty() throws Exception {
        mvc.perform(get("/api/sudoku/puzzle").param("difficulty", "extreme"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void checkAcceptsSolvedGrid() throws Exception {
        mvc.perform(post("/api/sudoku/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(game.solution(), 100, 0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.solved").value(true))
                .andExpect(jsonPath("$.score").value(2354))
                .andExpect(jsonPath("$.breakdown.perfectBonus").value(214));
    }

    @Test
    void checkReportsIncompleteGrid() throws Exception {
        mvc.perform(post("/api/sudoku/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(game.puzzle(), 5, 0)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.complete").value(false))
                .andExpect(jsonPath("$.solved").value(false));
    }

    @Test
    void checkRejectsMalformedGrid() throws Exception {
        String json = "{\"difficulty\":\"easy\",\"puzzle\":[1,2],\"values\":[1,2],\"seconds\":0,\"mistakes\":0}";

        mvc.perform(post("/api/sudoku/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    private String body(int[] values, int seconds, int mistakes) {
        return "{\"difficulty\":\"easy\",\"puzzle\":" + Arrays.toString(game.puzzle())
                + ",\"values\":" + Arrays.toString(values)
                + ",\"seconds\":" + seconds + ",\"mistakes\":" + mistakes + "}";
    }
}
