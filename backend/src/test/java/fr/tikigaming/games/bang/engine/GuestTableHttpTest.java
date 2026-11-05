package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import jakarta.servlet.http.Cookie;
import java.util.Collections;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
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
@Import(GuestTableHttpTest.Setup.class)
class GuestTableHttpTest {
    private static final String TABLES = "/api/games/bang/tables";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @TestConfiguration
    static class Setup {
        @Bean
        @Primary
        InitialDeal guestDeal(GameCatalog catalog) {
            // Le mélange seul est contrôlé : Shérif/Bart en place 3, Janet en place 4.
            return new InitialDeal(catalog, cards -> {
                if (cards.size() == 4) Collections.rotate(cards, 2);
            });
        }
    }

    @Test
    void twoGuestsHaveDistinctPrivateSeatsAndRecoverThemUsingTheirOwnSession() throws Exception {
        MockHttpSession owner = account();
        MockHttpSession second = account();
        MockHttpSession firstGuest = new MockHttpSession();
        MockHttpSession secondGuest = new MockHttpSession();
        String code = body(mvc.perform(command(TABLES, owner)).andExpect(status().isCreated()))
                .path("code")
                .asString();
        join(code, second)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(2));

        join(code, firstGuest)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(3));
        join(code, secondGuest)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(4));
        join(code, firstGuest)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(3));
        join(code, secondGuest)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(4));
        mvc.perform(command(TABLES + "/" + code + "/start", firstGuest)).andExpect(status().isOk());

        JsonNode third = body(view(code, firstGuest).andExpect(status().isOk()));
        JsonNode fourth = body(view(code, secondGuest).andExpect(status().isOk()));
        assertThat(third.path("seat").asInt()).isEqualTo(3);
        assertThat(fourth.path("seat").asInt()).isEqualTo(4);
        assertThat(third.path("role").asString()).isEqualTo("SHERIFF");
        assertThat(fourth.path("role").asString()).isEqualTo("OUTLAW");
        for (JsonNode player : third.path("players")) {
            assertThat(player.has("hand")).isFalse();
            assertThat(player.has("accountId")).isFalse();
            assertThat(player.has("role")).isEqualTo(player.path("seat").asInt() == 3);
        }
        for (JsonNode card : fourth.path("hand")) {
            assertThat(third.toString()).doesNotContain(card.path("id").asString());
        }
        assertThat(third.has("drawPile")).isFalse();
        assertThat(AuthSession.currentUser(request(firstGuest))).isNull();
        assertThat(AuthSession.currentUser(request(secondGuest))).isNull();
    }

    private ResultActions join(String code, MockHttpSession session) throws Exception {
        return mvc.perform(command(TABLES + "/" + code + "/join", session));
    }

    @Test
    void theCodeAndAClaimedSeatCannotReplaceAnotherPlayersSession() throws Exception {
        Table table = fullTable();
        MockHttpSession intruder = new MockHttpSession();
        view(table.code(), intruder).andExpect(status().isUnauthorized());
        mvc.perform(command(TABLES + "/" + table.code() + "/join", intruder)
                        .param("seat", "3")
                        .param("accountId", "guest:claimed"))
                .andExpect(status().isConflict());
        view(table.code(), intruder).andExpect(status().isForbidden());
        join(table.code(), table.shooter())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(3));
        join(table.code(), table.target())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(4));
    }

    @Test
    void guestsShootDodgeAndAcceptThroughTheRealEngineButCannotSubmitAScore() throws Exception {
        Table table = fullTable();
        String base = TABLES + "/" + table.code();
        mvc.perform(command(base + "/start", table.shooter())).andExpect(status().isOk());
        mvc.perform(command(base + "/turn/draw", table.shooter())).andExpect(status().isNoContent());
        mvc.perform(command(base + "/shots/BANG-8/targets/4", table.shooter())).andExpect(status().isNoContent());
        String firstShot = body(view(table.code(), table.target()))
                .path("pendingShot")
                .path("id")
                .asString();
        mvc.perform(command(base + "/shots/" + firstShot + "/accept", table.owner()))
                .andExpect(status().isForbidden());
        mvc.perform(command(base + "/shots/" + firstShot + "/dodge/BANG-13", table.target()))
                .andExpect(status().isNoContent());
        view(table.code(), table.target())
                .andExpect(jsonPath("$.players[3].health").value(4))
                .andExpect(jsonPath("$.hand.length()").value(3));
        mvc.perform(command(base + "/turn/end", table.shooter())).andExpect(status().isNoContent());
        mvc.perform(command(base + "/turn/discard/BANG-9", table.shooter())).andExpect(status().isNoContent());
        mvc.perform(command(base + "/turn/end", table.shooter())).andExpect(status().isNoContent());
        mvc.perform(command(base + "/turn/draw", table.target())).andExpect(status().isNoContent());
        mvc.perform(command(base + "/shots/BANG-14/targets/3", table.target())).andExpect(status().isNoContent());
        String secondShot = body(view(table.code(), table.shooter()))
                .path("pendingShot")
                .path("id")
                .asString();
        mvc.perform(command(base + "/shots/" + secondShot + "/accept", table.shooter()))
                .andExpect(status().isNoContent());
        view(table.code(), table.shooter())
                .andExpect(jsonPath("$.players[2].health").value(4))
                .andExpect(jsonPath("$.players[2].maxHealth").value(5))
                .andExpect(jsonPath("$.hand.length()").value(6))
                .andExpect(jsonPath("$.currentSeat").value(4))
                .andExpect(jsonPath("$.phase").value("PLAY"));
        mvc.perform(command(base + "/shots/" + secondShot + "/accept", table.shooter()))
                .andExpect(status().isConflict());
        for (MockHttpSession guest : new MockHttpSession[] {table.shooter(), table.target()}) {
            mvc.perform(command("/api/scores", guest)
                            .contentType("application/json")
                            .content("{\"gameSlug\":\"bang\",\"score\":100,\"metadata\":{\"finished\":true}}"))
                    .andExpect(status().isUnauthorized());
            assertThat(AuthSession.currentUser(request(guest))).isNull();
        }
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "",
                "/CODE/join",
                "/CODE/start",
                "/CODE/turn/draw",
                "/CODE/turn/end",
                "/CODE/turn/discard/BANG-1",
                "/CODE/shots/BANG-1/targets/2",
                "/CODE/shots/shot/accept",
                "/CODE/shots/shot/dodge/MISSED-1"
            })
    void guestsStillNeedAValidCsrfTokenForEveryMutation(String path) throws Exception {
        mvc.perform(post(TABLES + path).session(new MockHttpSession())).andExpect(status().isForbidden());
        mvc.perform(post(TABLES + path)
                        .session(new MockHttpSession())
                        .cookie(new Cookie("XSRF-TOKEN", "expected"))
                        .header("X-XSRF-TOKEN", "wrong"))
                .andExpect(status().isForbidden());
    }

    private record Table(String code, MockHttpSession owner, MockHttpSession shooter, MockHttpSession target) {}

    private Table fullTable() throws Exception {
        MockHttpSession owner = account();
        String code = body(mvc.perform(command(TABLES, owner)).andExpect(status().isCreated()))
                .path("code")
                .asString();
        join(code, account()).andExpect(status().isOk());
        MockHttpSession shooter = new MockHttpSession();
        MockHttpSession target = new MockHttpSession();
        join(code, shooter).andExpect(status().isOk());
        join(code, target).andExpect(status().isOk());
        return new Table(code, owner, shooter, target);
    }

    private ResultActions view(String code, MockHttpSession session) throws Exception {
        return mvc.perform(get(TABLES + "/" + code + "/state").session(session));
    }

    private MockHttpServletRequestBuilder command(String path, MockHttpSession session) throws Exception {
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        return post(path).session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private MockHttpSession account() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(UUID.randomUUID().toString(), "bang@example.test"));
        return (MockHttpSession) request.getSession();
    }

    private MockHttpServletRequest request(MockHttpSession session) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(session);
        return request;
    }
}
