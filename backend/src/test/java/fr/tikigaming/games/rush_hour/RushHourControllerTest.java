package fr.tikigaming.games.rush_hour;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Tests HTTP de l'endpoint, branché sur le vrai service (pur et rapide : aucune doublure nécessaire). */
@WebMvcTest(
        value = RushHourController.class,
        properties =
                "spring.autoconfigure.exclude="
                        + "org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration")
@AutoConfigureMockMvc(addFilters = false)
@Import({LevelResultService.class, ResultRateLimiter.class})
class RushHourControllerTest {

    /** Solution la plus courte du niveau 1 (3 coups). */
    private static final String LEVEL_1_SOLUTION =
            "[{\"vehicle\":\"A\",\"delta\":3},{\"vehicle\":\"H\",\"delta\":-1},{\"vehicle\":\"X\",\"delta\":3}]";

    @Autowired
    private MockMvc mvc;

    private ResultActions send(int level, String body) throws Exception {
        return mvc.perform(post("/api/games/rush-hour/levels/" + level + "/results")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    @Test
    void returnsTheScoreComputedByTheServer() throws Exception {
        send(1, "{\"moves\":" + LEVEL_1_SOLUTION + ",\"hints\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(1000))
                .andExpect(jsonPath("$.moves").value(3))
                .andExpect(jsonPath("$.optimal").value(3));
    }

    @Test
    void refusesACheatedGameWith422() throws Exception {
        send(1, "{\"moves\":[{\"vehicle\":\"X\",\"delta\":3}],\"hints\":0}")
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Partie refusée : Déplacement impossible : X de 3"));
    }

    @Test
    void unknownLevelIs404() throws Exception {
        send(21, "{\"moves\":" + LEVEL_1_SOLUTION + ",\"hints\":0}")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Niveau inconnu : 21"));
    }

    @Test
    void missingMovesAre400() throws Exception {
        send(1, "{\"hints\":0}").andExpect(status().isBadRequest());
    }

    @Test
    void negativeHintsAre400() throws Exception {
        send(1, "{\"moves\":" + LEVEL_1_SOLUTION + ",\"hints\":-1}").andExpect(status().isBadRequest());
    }
}
