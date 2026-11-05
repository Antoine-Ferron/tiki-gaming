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

/** L'endpoint refuse (429) un client qui envoie trop de parties en une minute. Limite réduite à 2 pour le test. */
@WebMvcTest(
        value = RushHourController.class,
        properties = {
            "spring.autoconfigure.exclude="
                    + "org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration",
            "tiki.rush-hour.max-results-per-minute=2"
        })
@AutoConfigureMockMvc(addFilters = false)
@Import({LevelResultService.class, ResultRateLimiter.class})
class RushHourRateLimitTest {

    private static final String LEVEL_1_GAME = "{\"moves\":[{\"vehicle\":\"A\",\"delta\":3},"
            + "{\"vehicle\":\"H\",\"delta\":-1},{\"vehicle\":\"X\",\"delta\":3}],\"hints\":0}";

    @Autowired
    private MockMvc mvc;

    private ResultActions sendFrom(String address) throws Exception {
        return mvc.perform(post("/api/games/rush-hour/levels/1/results")
                .with(request -> {
                    request.setRemoteAddr(address);
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content(LEVEL_1_GAME));
    }

    @Test
    void aClientOverTheLimitIsRefusedWith429() throws Exception {
        // Arrange : le client a utilisé ses 2 parties de la minute
        sendFrom("203.0.113.7").andExpect(status().isOk());
        sendFrom("203.0.113.7").andExpect(status().isOk());

        // Act + Assert
        sendFrom("203.0.113.7")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("Trop de parties envoyées : réessaie dans une minute."));
    }

    @Test
    void anotherClientIsNotAffected() throws Exception {
        // Arrange : un autre client a épuisé sa minute
        sendFrom("198.51.100.9").andExpect(status().isOk());
        sendFrom("198.51.100.9").andExpect(status().isOk());
        sendFrom("198.51.100.9");

        // Act + Assert
        sendFrom("192.0.2.44").andExpect(status().isOk());
    }
}
