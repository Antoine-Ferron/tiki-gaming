package fr.tikigaming.games.bang;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
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
class PrivateTablesHttpTest {

    private static final String TABLES = "/api/games/bang/tables";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

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
        CyclicBarrier start = new CyclicBarrier(2);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> joinAtTheSameTime(code, "challenger-a", start));
            var second = executor.submit(() -> joinAtTheSameTime(code, "challenger-b", start));
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

        postAs(TABLES + "/" + code + "/join", sessionFor("latecomer"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Cette table est pleine."));
    }

    private MvcResult joinAtTheSameTime(String code, String accountId, CyclicBarrier start) throws Exception {
        start.await(5, TimeUnit.SECONDS);
        return postAs(TABLES + "/" + code + "/join", sessionFor(accountId)).andReturn();
    }

    private String createTable(String accountId) throws Exception {
        String body = postAs(TABLES, sessionFor(accountId))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return json.readTree(body).get("code").asText();
    }

    private ResultActions postAs(String path, MockHttpSession session) throws Exception {
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        return mvc.perform(post(path).session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()));
    }

    private static MockHttpSession sessionFor(String accountId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountId, accountId + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
