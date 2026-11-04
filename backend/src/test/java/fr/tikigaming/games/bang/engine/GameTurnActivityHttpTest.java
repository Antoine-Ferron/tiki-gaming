package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.model.GameState;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
@Import(GameTurnActivityHttpTest.Setup.class)
class GameTurnActivityHttpTest {
    private static final String TABLES = "/api/games/bang/tables";
    private final String accountPrefix = UUID.randomUUID().toString();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private PrivateTableService tables;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private MutableClock clock;

    @TestConfiguration
    static class Setup {
        @Bean
        MutableClock clock() {
            return new MutableClock();
        }

        @Bean
        @Primary
        InitialDeal orderedDeal() {
            return new InitialDeal(new TestGameCatalog(), cards -> {});
        }

        @Bean
        @Primary
        PrivateTableService timedTables(InitialDeal initialDeal, MutableClock clock) {
            return new PrivateTableService(initialDeal, clock);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"draw", "enter-discard", "discard", "end-turn"})
    void acceptedTurnActionsExtendTheTablesLifetime(String action) throws Exception {
        String stage = switch (action) {
            case "draw" -> "DRAW";
            case "enter-discard" -> "PLAY";
            default -> "DISCARD";
        };
        String code = preparedTable(stage);
        if (action.equals("end-turn")) {
            turn(code, "discard/test-card-1", 1).andExpect(status().isNoContent());
            turn(code, "discard/test-card-2", 1).andExpect(status().isNoContent());
        }
        String command = switch (action) {
            case "draw" -> "draw";
            case "discard" -> "discard/test-card-1";
            default -> "end";
        };
        clock.advance(Duration.ofMinutes(59));

        turn(code, command, 1).andExpect(status().isNoContent());

        GameState accepted = tables.game(code);
        clock.advance(Duration.ofMinutes(59));
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1))).andExpect(status().isOk());
        assertThat(tables.game(code)).isSameAs(accepted);
        clock.advance(Duration.ofMinutes(1));
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1))).andExpect(status().isNotFound());
        assertThat(tables.game(code)).isNull();
    }

    @ParameterizedTest
    @CsvSource({
        "DRAW, end, 1, 409",
        "DRAW, discard/test-card-1, 1, 409",
        "PLAY, draw, 1, 409",
        "PLAY, discard/test-card-1, 1, 409",
        "DISCARD, end, 1, 409",
        "DISCARD, draw, 1, 409",
        "DISCARD, discard/test-card-6, 1, 409",
        "DISCARD, discard/inconnue, 1, 409",
        "DISCARD, discard/test-card-1, 2, 403",
        "PLAY, draw, 5, 403",
        "PLAY, end, 0, 401"
    })
    void refusedTurnActionsDoNotExtendTheTablesLifetime(String stage, String command, int seat, int status)
            throws Exception {
        String code = preparedTable(stage);
        GameState before = tables.game(code);
        clock.advance(Duration.ofMinutes(59));

        turn(code, command, seat).andExpect(status().is(status));

        assertThat(tables.game(code)).isSameAs(before);
        clock.advance(Duration.ofMinutes(1));
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1))).andExpect(status().isNotFound());
        assertThat(tables.game(code)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"draw", "end", "discard/test-card-1"})
    void csrfRefusalsDoNotExtendTheTablesLifetime(String command) throws Exception {
        String code = preparedTable("DRAW");
        GameState before = tables.game(code);
        clock.advance(Duration.ofMinutes(59));

        mvc.perform(post(TABLES + "/{code}/turn/" + command, code).session(sessionFor(1)))
                .andExpect(status().isForbidden());

        assertThat(tables.game(code)).isSameAs(before);
        clock.advance(Duration.ofMinutes(1));
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1))).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(strings = {"DRAW", "PLAY", "DISCARD"})
    void readingAnyPhaseWithANewSessionDoesNotExtendTheTablesLifetime(String stage) throws Exception {
        String code = preparedTable(stage);
        GameState before = tables.game(code);
        clock.advance(Duration.ofMinutes(59));

        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1))).andExpect(status().isOk());
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(2))).andExpect(status().isOk());

        assertThat(tables.game(code)).isSameAs(before);
        clock.advance(Duration.ofMinutes(1));
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1))).andExpect(status().isNotFound());
    }

    private String preparedTable(String stage) throws Exception {
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
        if (!stage.equals("DRAW")) turn(code, "draw", 1).andExpect(status().isNoContent());
        if (stage.equals("DISCARD")) turn(code, "end", 1).andExpect(status().isNoContent());
        return code;
    }

    private ResultActions turn(String code, String command, int seat) throws Exception {
        return postAs(TABLES + "/" + code + "/turn/" + command, sessionFor(seat));
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
        if (seat == 0) return new MockHttpSession();
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountPrefix + ":player-" + seat, "player-" + seat + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
