package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.model.GameState;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Locale;
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
import org.springframework.test.json.JsonCompareMode;
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
@Import(GameViewHttpTest.Setup.class)
class GameViewHttpTest {
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
    void aPlayerReceivesOnlyTheirPrivateCardsAndThePublicTable() throws Exception {
        String code = startedTable();

        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(2)))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {
                          "code":"%s", "seat":2, "currentSeat":1, "phase":"DRAW", "role":"OUTLAW",
                          "hand":[
                            {"id":"test-card-6","type":"MISSED"},
                            {"id":"test-card-7","type":"BANG"},
                            {"id":"test-card-8","type":"MISSED"},
                            {"id":"test-card-9","type":"BANG"}
                          ],
                          "players":[
                            {"seat":1,"character":"BART_CASSIDY","health":5,"maxHealth":5,
                             "playedCards":[],"handCount":5,"role":"SHERIFF"},
                            {"seat":2,"character":"CALAMITY_JANET","health":4,"maxHealth":4,
                             "playedCards":[],"handCount":4},
                            {"seat":3,"character":"PAUL_REGRET","health":3,"maxHealth":3,
                             "playedCards":[],"handCount":3},
                            {"seat":4,"character":"WILLY_THE_KID","health":4,"maxHealth":4,
                             "playedCards":[],"handCount":4}
                          ]
                        }
                        """.formatted(code), JsonCompareMode.STRICT));
    }

    @Test
    void readingNormalizesCaseAndOuterSpacesLikeJoining() throws Exception {
        String code = startedTable();
        String canonical = mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(2)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        for (String entered : List.of(code.toLowerCase(Locale.ROOT), "  " + code.toLowerCase(Locale.ROOT) + "  ")) {
            String normalized = mvc.perform(
                            get(TABLES + "/{code}/state", entered).session(sessionFor(2)))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            assertThat(normalized).isEqualTo(canonical);
        }
    }

    @Test
    void fourAccountsKeepTheirOwnViewsAcrossAlternatingReadsAndNewSessions() throws Exception {
        String code = startedTable();
        GameState original = tables.game(code);
        MockHttpSession oldSession = sessionFor(2);
        MockHttpSession newSession = sessionFor(2);
        assertThat(newSession.getId()).isNotEqualTo(oldSession.getId());

        for (int seat : List.of(2, 4, 1, 3, 4, 2, 3, 1)) {
            MockHttpSession session = seat == 2 ? oldSession : sessionFor(seat);
            mvc.perform(get(TABLES + "/{code}/state", code)
                            .session(session)
                            .param("seat", "4")
                            .param("accountId", accountPrefix + ":player-4"))
                    .andExpect(status().isOk())
                    .andExpect(content().json(expectedView(code, seat), JsonCompareMode.STRICT));
        }
        mvc.perform(get(TABLES + "/{code}/state", code).session(newSession))
                .andExpect(status().isOk())
                .andExpect(content().json(expectedView(code, 2), JsonCompareMode.STRICT));

        assertThat(tables.game(code)).isSameAs(original);
        assertThat(original.drawPile()).hasSize(24);
        assertThat(original.currentSeat()).isEqualTo(1);
        assertThat(original.players())
                .allSatisfy(player -> assertThat(player.roleCard().faceUp())
                        .isEqualTo(player.roleCard().role() == Role.SHERIFF));
    }

    private static String expectedView(String code, int seat) {
        String[] hands = {"""
            [{"id":"test-card-1","type":"BANG"},{"id":"test-card-2","type":"MISSED"},
             {"id":"test-card-3","type":"BANG"},{"id":"test-card-4","type":"MISSED"},
             {"id":"test-card-5","type":"BANG"}]
            """, """
            [{"id":"test-card-6","type":"MISSED"},{"id":"test-card-7","type":"BANG"},
             {"id":"test-card-8","type":"MISSED"},{"id":"test-card-9","type":"BANG"}]
            """, """
            [{"id":"test-card-10","type":"MISSED"},{"id":"test-card-11","type":"BANG"},
             {"id":"test-card-12","type":"MISSED"}]
            """, """
            [{"id":"test-card-13","type":"BANG"},{"id":"test-card-14","type":"MISSED"},
             {"id":"test-card-15","type":"BANG"},{"id":"test-card-16","type":"MISSED"}]
            """};
        String[] roles = {"SHERIFF", "OUTLAW", "OUTLAW", "RENEGADE"};
        return """
                {"code":"%s","seat":%d,"currentSeat":1,"phase":"DRAW","role":"%s","hand":%s,
                 "players":[
                   {"seat":1,"character":"BART_CASSIDY","health":5,"maxHealth":5,
                    "playedCards":[],"handCount":5,"role":"SHERIFF"},
                   {"seat":2,"character":"CALAMITY_JANET","health":4,"maxHealth":4,
                    "playedCards":[],"handCount":4},
                   {"seat":3,"character":"PAUL_REGRET","health":3,"maxHealth":3,
                    "playedCards":[],"handCount":3},
                   {"seat":4,"character":"WILLY_THE_KID","health":4,"maxHealth":4,
                    "playedCards":[],"handCount":4}
                 ]}
                """.formatted(code, seat, roles[seat - 1], hands[seat - 1]);
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
