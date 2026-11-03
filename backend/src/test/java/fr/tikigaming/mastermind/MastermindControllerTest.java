package fr.tikigaming.mastermind;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        value = MastermindController.class,
        properties =
                "spring.autoconfigure.exclude="
                        + "org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration")
@AutoConfigureMockMvc(addFilters = false)
class MastermindControllerTest {
    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private MastermindService service;

    private static final UUID ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final MastermindGameSnapshot SNAPSHOT =
            new MastermindGameSnapshot(ID, MastermindStatus.IN_PROGRESS, 0, 10, List.of(), null, 0);

    @Test
    void createsGameWith201() throws Exception {
        when(service.create()).thenReturn(SNAPSHOT);

        mvc.perform(post("/api/games"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(ID.toString()))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.attemptsRemaining").value(10))
                .andExpect(jsonPath("$.secret").doesNotExist());
    }

    @Test
    void getsGameWith200AndDoesNotExposeSecretInProgress() throws Exception {
        when(service.get(ID)).thenReturn(SNAPSHOT);

        mvc.perform(get("/api/games/{id}", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attemptsRemaining").value(10))
                .andExpect(jsonPath("$.secret").doesNotExist());
    }

    @Test
    void validatesGuessAndReturnsUpdatedGame() throws Exception {
        MastermindGameSnapshot afterGuess = new MastermindGameSnapshot(
                ID,
                MastermindStatus.IN_PROGRESS,
                1,
                9,
                List.of(new MastermindGuessResult(
                        List.of(
                                MastermindColor.RED,
                                MastermindColor.BLUE,
                                MastermindColor.GREEN,
                                MastermindColor.YELLOW),
                        new MastermindFeedback(4, 0))),
                null,
                0);
        when(service.guess(eq(ID), any())).thenReturn(afterGuess);

        mvc.perform(post("/api/games/{id}/guesses", ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {"colors":["red","blue","green","yellow"]}
                    """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attemptsUsed").value(1))
                .andExpect(jsonPath("$.history[0].feedback.exact").value(4));
    }

    @Test
    void returns400ForInvalidGuess() throws Exception {
        mvc.perform(post("/api/games/{id}/guesses", ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {"colors":["red","blue","green"]}
                    """))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("exactement 4")));
    }

    @Test
    void returns404ForUnknownGame() throws Exception {
        when(service.get(ID)).thenThrow(new MastermindNotFoundException("Partie introuvable."));

        mvc.perform(get("/api/games/{id}", ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Partie introuvable."));
    }

    @Test
    void returns409WhenGuessingFinishedGame() throws Exception {
        when(service.guess(eq(ID), any())).thenThrow(new MastermindFinishedException("La partie est déjà terminée."));

        mvc.perform(post("/api/games/{id}/guesses", ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                    {"colors":["red","blue","green","yellow"]}
                    """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("La partie est déjà terminée."));
    }

    @Test
    void restartsExistingGame() throws Exception {
        when(service.restart(ID)).thenReturn(SNAPSHOT);

        mvc.perform(post("/api/games/{id}/restart", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.attemptsUsed").value(0));
    }

    @Test
    void includesScoreWhenGameIsWon() throws Exception {
        MastermindGameSnapshot won = new MastermindGameSnapshot(
                ID,
                MastermindStatus.WON,
                1,
                9,
                List.of(),
                List.of(MastermindColor.RED, MastermindColor.BLUE, MastermindColor.GREEN, MastermindColor.YELLOW),
                10);
        when(service.get(ID)).thenReturn(won);

        mvc.perform(get("/api/games/{id}", ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(10))
                .andExpect(jsonPath("$.secret").isArray());
    }
}
