package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
        properties = {
            "spring.config.import=",
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@AutoConfigureMockMvc
@Import(GameTurnHttpTest.Setup.class)
class GameTurnHttpTest {
    private static final String TABLES = "/api/games/bang/tables";
    private final String accountPrefix = UUID.randomUUID().toString();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private PrivateTableService tables;

    @TestConfiguration
    static class Setup {
        @Bean
        @Primary
        InitialDeal orderedDeal() {
            return new InitialDeal(new TestGameCatalog(), cards -> {});
        }
    }

    @Test
    void sheriffDrawsTheFirstTwoCardsOnlyAfterTheInitialDeal() throws Exception {
        String code = startedTable();
        assertThat(tables.game(code).players().getFirst().hand()).hasSize(5);
        assertThat(tables.game(code).drawPile()).hasSize(24);
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentSeat").value(1))
                .andExpect(jsonPath("$.phase").value("DRAW"))
                .andExpect(jsonPath("$.hand.length()").value(5));

        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isNoContent());

        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phase").value("PLAY"))
                .andExpect(jsonPath("$.hand.length()").value(7))
                .andExpect(jsonPath("$.hand[5].id").value("test-card-17"))
                .andExpect(jsonPath("$.hand[6].id").value("test-card-18"));
        assertThat(tables.game(code).drawPile()).hasSize(22);
    }

    @Test
    void onlyTheActiveSeatedAccountCanDraw() throws Exception {
        String code = startedTable();
        var original = tables.game(code);

        postAs(TABLES + "/" + code + "/turn/draw", new MockHttpSession()).andExpect(status().isUnauthorized());
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(5)).andExpect(status().isForbidden());
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(2)).andExpect(status().isForbidden());

        assertThat(tables.game(code)).isSameAs(original);
    }

    private String startedTable() throws Exception {
        String body = postAs(TABLES, sessionFor(1))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String code = json.readTree(body).path("code").asString();
        for (int seat = 2; seat <= 4; seat++) {
            postAs(TABLES + "/" + code + "/join", sessionFor(seat)).andExpect(status().isOk());
        }
        postAs(TABLES + "/" + code + "/start", sessionFor(1)).andExpect(status().isOk());
        return code;
    }

    private ResultActions postAs(String path, MockHttpSession session) throws Exception {
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        return mvc.perform(post(path).session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()));
    }

    private MockHttpSession sessionFor(int seat) {
        String accountId = accountPrefix + ":player-" + seat;
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountId, "player-" + seat + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
