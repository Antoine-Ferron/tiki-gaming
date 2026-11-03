package fr.tikigaming.games.bang.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.model.TableSeat;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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
class PrivateTablesHttpTest {

    private static final String TABLES = "/api/games/bang/tables";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Test
    void threePlayersCannotStartAPrivateTable() throws Exception {
        String code = createTable("creator");
        postAs(TABLES + "/" + code + "/join", sessionFor("second")).andExpect(status().isOk());
        postAs(TABLES + "/" + code + "/join", sessionFor("third")).andExpect(status().isOk());

        postAs(TABLES + "/" + code + "/start", sessionFor("creator"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Il faut quatre joueurs pour démarrer la partie."));
    }

    @Test
    void connectedPlayerCreatesAPrivateTableAndTakesTheFirstSeat() throws Exception {
        postAs(TABLES, sessionFor("creator"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code", not(emptyOrNullString())))
                .andExpect(jsonPath("$.seat").value(1))
                .andExpect(jsonPath("$.playerCount").value(1));
    }

    @Test
    void threeOtherAccountsJoinUsingTheSharedCode() throws Exception {
        String code = createTable("creator");

        for (int seat = 2; seat <= 4; seat++) {
            postAs(TABLES + "/" + code + "/join", sessionFor("player-" + seat))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(code))
                    .andExpect(jsonPath("$.seat").value(seat))
                    .andExpect(jsonPath("$.playerCount").value(seat));
        }
    }

    @Test
    void unknownCodeIsRefused() throws Exception {
        postAs(TABLES + "/UNKNOWN/join", sessionFor("player"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Code de table inconnu."));
    }

    @Test
    void theLastSeatIsGrantedOnceEvenWithTwoSimultaneousRequests() throws Exception {
        String code = createTable("creator");
        postAs(TABLES + "/" + code + "/join", sessionFor("second")).andExpect(status().isOk());
        postAs(TABLES + "/" + code + "/join", sessionFor("third")).andExpect(status().isOk());
        var firstRequest = preparePost(TABLES + "/" + code + "/join", sessionFor("challenger-a"));
        var secondRequest = preparePost(TABLES + "/" + code + "/join", sessionFor("challenger-b"));
        CyclicBarrier start = new CyclicBarrier(2);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> joinAtTheSameTime(firstRequest, start));
            var second = executor.submit(() -> joinAtTheSameTime(secondRequest, start));
            MvcResult firstResult = first.get(5, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(5, TimeUnit.SECONDS);

            assertThat(List.of(
                            firstResult.getResponse().getStatus(),
                            secondResult.getResponse().getStatus()))
                    .containsExactlyInAnyOrder(200, 409);
            MvcResult accepted = firstResult.getResponse().getStatus() == 200 ? firstResult : secondResult;
            assertThat(json.readValue(accepted.getResponse().getContentAsString(), TableSeat.class))
                    .isEqualTo(new TableSeat(code, 4, 4));
        }

        postAs(TABLES + "/" + code + "/join", sessionFor("creator"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerCount").value(4));
        postAs(TABLES + "/" + code + "/join", sessionFor("latecomer"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Cette table est pleine."));
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4})
    void aSeatedAccountReturnsToItsSeatAfterRefreshAndANewHttpSessionAtAFullTable(int seat) throws Exception {
        List<MockHttpSession> sessions =
                List.of(sessionFor("player-1"), sessionFor("player-2"), sessionFor("player-3"), sessionFor("player-4"));
        String code = createTable(sessions.getFirst());
        for (int player = 2; player <= 4; player++) {
            postAs(TABLES + "/" + code + "/join", sessions.get(player - 1)).andExpect(status().isOk());
        }

        MockHttpSession previousSession = sessions.get(seat - 1);
        String previousSessionId = previousSession.getId();
        postAs(TABLES + "/" + code + "/join", previousSession)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(seat))
                .andExpect(jsonPath("$.playerCount").value(4));
        postAs("/api/auth/logout", previousSession).andExpect(status().isNoContent());
        MockHttpSession newSession = sessionFor("player-" + seat);
        assertThat(newSession.getId()).isNotEqualTo(previousSessionId);

        postAs(TABLES + "/" + code + "/join", newSession)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.seat").value(seat))
                .andExpect(jsonPath("$.playerCount").value(4));
    }

    @Test
    void visitorsCannotCreateATableEvenWithAValidCsrfToken() throws Exception {
        postAs(TABLES, new MockHttpSession())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Non connecté"));
    }

    @Test
    void visitorsCannotJoinATableEvenWithAValidCsrfToken() throws Exception {
        String code = createTable("creator");

        postAs(TABLES + "/" + code + "/join", new MockHttpSession())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Non connecté"));
    }

    @ParameterizedTest
    @ValueSource(strings = {TABLES, TABLES + "/UNKNOWN/join"})
    void connectedPlayersMustSendACsrfToken(String path) throws Exception {
        mvc.perform(post(path).session(sessionFor("player"))).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {TABLES, TABLES + "/UNKNOWN/join"})
    void connectedPlayersCannotUseAMismatchingCsrfToken(String path) throws Exception {
        mvc.perform(post(path)
                        .session(sessionFor("player"))
                        .cookie(new Cookie("XSRF-TOKEN", "expected-token"))
                        .header("X-XSRF-TOKEN", "wrong-token"))
                .andExpect(status().isForbidden());
    }

    @Test
    void swaggerDescribesTheTableRoutesAndTheirErrorBodies() throws Exception {
        ResultActions docs = mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['" + TABLES + "'].post.tags[0]").value("bang"))
                .andExpect(jsonPath("$.paths['" + TABLES + "'].post.summary", not(emptyOrNullString())))
                .andExpect(jsonPath("$.paths['" + TABLES + "'].post.responses['201']")
                        .exists())
                .andExpect(jsonPath("$.paths['" + TABLES + "/{code}/join'].post.summary", not(emptyOrNullString())))
                .andExpect(jsonPath("$.paths['" + TABLES + "/{code}/join'].post.tags[0]")
                        .value("bang"));

        for (String path : List.of(TABLES, TABLES + "/{code}/join")) {
            docs.andExpect(jsonPath("$.paths['" + path + "'].post.responses['401'].content.*.schema['$ref']")
                            .value(org.hamcrest.Matchers.hasItem("#/components/schemas/ApiError")))
                    .andExpect(jsonPath("$.paths['" + path
                                    + "'].post.responses['403'].content['application/json'].schema['$ref']")
                            .value("#/components/schemas/CsrfErrorResponse"));
        }
        for (int error : List.of(404, 409)) {
            docs.andExpect(jsonPath("$.paths['" + TABLES + "/{code}/join'].post.responses['" + error
                            + "'].content.*.schema['$ref']")
                    .value(org.hamcrest.Matchers.hasItem("#/components/schemas/ApiError")));
        }
    }

    private MvcResult joinAtTheSameTime(MockHttpServletRequestBuilder request, CyclicBarrier start) throws Exception {
        start.await(5, TimeUnit.SECONDS);
        return mvc.perform(request).andReturn();
    }

    private String createTable(String accountId) throws Exception {
        return createTable(sessionFor(accountId));
    }

    private String createTable(MockHttpSession session) throws Exception {
        String body = postAs(TABLES, session)
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return json.readTree(body).get("code").asString();
    }

    private ResultActions postAs(String path, MockHttpSession session) throws Exception {
        return mvc.perform(preparePost(path, session));
    }

    private MockHttpServletRequestBuilder preparePost(String path, MockHttpSession session) throws Exception {
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        return post(path).session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
    }

    private static MockHttpSession sessionFor(String accountId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountId, accountId + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
