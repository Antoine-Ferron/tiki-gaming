package fr.tikigaming.games.echecs.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Test d'intégration (cours J2_PM) : toute l'application Spring démarre, avec la vraie chaîne de sécurité (CSRF), la
 * validation, le contrôleur, le service et le moteur. Aucune doublure : on vérifie que les composants marchent
 * ensemble, ce que les tests unitaires et le test du contrôleur (service simulé) ne peuvent pas voir.
 */
@SpringBootTest(
        properties = {
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@AutoConfigureMockMvc
class EchecsApiIntegrationTest {

    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    @Autowired
    private MockMvc mvc;

    private MockHttpSession session;
    private Cookie csrf;

    /** Comme le front : lire le jeton CSRF dans le cookie XSRF-TOKEN posé par GET /api/auth/session. */
    @BeforeEach
    void obtenirLeJetonCsrf() throws Exception {
        session = new MockHttpSession();
        csrf = mvc.perform(get("/api/auth/session").session(session))
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        assertThat(csrf).as("cookie XSRF-TOKEN").isNotNull();
    }

    /** Envoie une requête comme le front : session, cookie et en-tête CSRF, corps JSON. */
    private ResultActions send(String route, String body) throws Exception {
        return mvc.perform(post("/api/games/echecs/" + route)
                .session(session)
                .cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private String play(String fen, String from, String to) throws Exception {
        String body = send("moves", "{\"fen\":\"" + fen + "\",\"from\":\"" + from + "\",\"to\":\"" + to + "\"}")
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.fen");
    }

    @Test
    @DisplayName("une courte partie jouée via l'API : chaque FEN renvoyée sert au coup suivant (1.e4 e5 2.Cf3)")
    void uneCourtePartieJoueeViaLApi() throws Exception {
        // Act : le front renvoie à chaque fois la position reçue
        String afterE4 = play(START, "e2", "e4");
        String afterE5 = play(afterE4, "e7", "e5");
        String afterNf3 = play(afterE5, "g1", "f3");

        // Assert
        assertThat(afterE4).isEqualTo("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
        assertThat(afterNf3).isEqualTo("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
    }

    @Test
    @DisplayName("les cases accessibles viennent du vrai moteur")
    void lesCasesAccessiblesViennentDuVraiMoteur() throws Exception {
        send("destinations", "{\"fen\":\"" + START + "\",\"from\":\"g1\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.destinations[0]").value("f3"))
                .andExpect(jsonPath("$.destinations[1]").value("h3"));
    }

    @Test
    @DisplayName("un coup interdit traverse toute la chaîne et revient en 422 avec le message du moteur")
    void unCoupInterditRevientEn422() throws Exception {
        send("moves", "{\"fen\":\"" + START + "\",\"from\":\"e2\",\"to\":\"e5\"}")
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error").value("Coup refusé : Case inaccessible pour la pièce en e2 : e5"));
    }

    @Test
    @DisplayName("une FEN mal écrite revient en 400, un corps incomplet aussi")
    void uneEntreeInvalideRevientEn400() throws Exception {
        send("destinations", "{\"fen\":\"abc\",\"from\":\"e2\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Entrée invalide : Une FEN a 6 champs : abc"));
        send("moves", "{\"from\":\"e2\",\"to\":\"e4\"}").andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("sans jeton CSRF, ou avec un faux jeton, la requête est refusée (403)")
    void sansJetonCsrfLaRequeteEstRefusee() throws Exception {
        String body = "{\"fen\":\"" + START + "\",\"from\":\"e2\",\"to\":\"e4\"}";
        mvc.perform(post("/api/games/echecs/moves")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/games/echecs/moves")
                        .session(session)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", "faux")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }
}
