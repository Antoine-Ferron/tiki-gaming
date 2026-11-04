package fr.tikigaming.games.echecs.api;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Tests HTTP du contrôleur, isolé du moteur : le service est remplacé par une doublure Mockito (cours J1_PM, école de
 * Londres). On vérifie seulement ce qui appartient au contrôleur : routes, JSON, codes HTTP, validation, appels.
 */
@WebMvcTest(
        value = EchecsController.class,
        properties =
                "spring.autoconfigure.exclude="
                        + "org.springframework.boot.security.oauth2.client.autoconfigure.servlet.OAuth2ClientWebSecurityAutoConfiguration")
@AutoConfigureMockMvc(addFilters = false)
class EchecsControllerTest {

    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private EchecsService service;

    private ResultActions send(String route, String body) throws Exception {
        return mvc.perform(post("/api/games/echecs/" + route)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    @Test
    @DisplayName("POST /destinations renvoie 200 et les cases données par le service")
    void destinationsRenvoieLesCasesDuService() throws Exception {
        // Arrange : le stub répond, quel que soit le moteur
        when(service.destinations(START, "e2")).thenReturn(List.of("e3", "e4"));

        // Act + Assert
        send("destinations", "{\"fen\":\"" + START + "\",\"from\":\"e2\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.destinations[0]").value("e3"))
                .andExpect(jsonPath("$.destinations[1]").value("e4"));
    }

    @Test
    @DisplayName("POST /moves renvoie 200 et la FEN calculée par le service")
    void movesRenvoieLaNouvelleFen() throws Exception {
        // Arrange
        String after = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
        when(service.play(START, "e2", "e4")).thenReturn(after);

        // Act + Assert
        send("moves", "{\"fen\":\"" + START + "\",\"from\":\"e2\",\"to\":\"e4\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fen").value(after));
    }
}
