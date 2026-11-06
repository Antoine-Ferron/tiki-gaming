package fr.tikigaming.games.dame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

/** Vraie application Spring et vraie chaîne CSRF, seul le port de persistance est remplacé. */
@SpringBootTest(
        properties = {
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://api-test.supabase.invalid",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@AutoConfigureMockMvc
@Import(DameApiHttpTest.Persistence.class)
class DameApiHttpTest {

    private static final String ROOT = "/api/games/dame/matches";
    private static final String START = "{\"whiteName\":\" Cherif \",\"blackName\":\"Amadou\"}";
    private static final String MOVE = """
            {"version":0,"from":{"row":6,"column":1},"landings":[{"row":5,"column":0}]}""";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @TestConfiguration
    static class Persistence {
        @Bean
        @Primary
        ApiMatches apiMatches() {
            return new ApiMatches();
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ApiMatches repository;

    private MockHttpSession owner;
    private Cookie csrf;

    @BeforeEach
    void setUp() throws Exception {
        repository.clear();
        owner = new MockHttpSession();
        csrf = mvc.perform(get("/api/auth/session").session(owner))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        assertThat(csrf).isNotNull();
    }

    private MockHttpServletRequestBuilder command(String path, MockHttpSession session, String body) {
        return post(path)
                .session(session)
                .cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
    }

    private DameGameView create() throws Exception {
        MvcResult result = mvc.perform(command(ROOT, owner, START))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andReturn();
        return JSON.readValue(result.getResponse().getContentAsByteArray(), DameGameView.class);
    }

    @Test
    void startsAGuestMatchWithItsLocationAndNormalizedNames() throws Exception {
        mvc.perform(command(ROOT, owner, START))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.whiteName").value("Cherif"))
                .andExpect(jsonPath("$.blackName").value("Amadou"))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.board.pieces.length()").value(40))
                .andExpect(jsonPath("$.currentPlayer").value("WHITE"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.winner").isEmpty())
                .andExpect(result ->
                        assertThat(result.getResponse().getHeader("Location")).startsWith(ROOT + "/"));
        assertThat(repository.rows).hasSize(1);
    }

    @Test
    void readsAndPlaysOnlyTheMatchKeptByTheSession() throws Exception {
        DameGameView created = create();
        String path = ROOT + "/" + created.id();
        mvc.perform(get(path).session(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(created.id().toString()));
        mvc.perform(command(path + "/moves", owner, MOVE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.currentPlayer").value("BLACK"));
        mvc.perform(command(path + "/moves", owner, MOVE)).andExpect(status().isConflict());
        assertThat(repository.writes).isEqualTo(2);
    }

    @Test
    void recoveryCookieIsPrivatePersistentAndSecureOnHttps() throws Exception {
        var result = mvc.perform(command(ROOT, owner, START).secure(true))
                .andExpect(status().isCreated())
                .andReturn();
        String header = result.getResponse().getHeaders("Set-Cookie").stream()
                .filter(value -> value.startsWith(DameController.COOKIE + "="))
                .findFirst()
                .orElseThrow();
        assertThat(header).contains("HttpOnly", "Secure", "SameSite=Strict", "Path=/api/games/dame", "Max-Age=2592000");
        String token = (String) owner.getAttribute(DameApplicationService.OWNER);
        var view = JSON.readValue(result.getResponse().getContentAsByteArray(), DameGameView.class);
        assertThat(repository.saves.get(view.id()).ownerHash()).isNotEqualTo(token);
        mvc.perform(get(ROOT + "/" + view.id()).cookie(new Cookie(DameController.COOKIE, token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(view.id().toString()));
        mvc.perform(get(ROOT + "/" + view.id()).cookie(new Cookie(DameController.COOKIE, "b".repeat(64))))
                .andExpect(status().isNotFound());
        mvc.perform(get(ROOT + "/" + view.id()).cookie(new Cookie(DameController.COOKIE, "invalid")))
                .andExpect(status().isNotFound());
    }

    @Test
    void anotherSessionCannotReadOrMoveAKnownMatch() throws Exception {
        DameGameView created = create();
        String path = ROOT + "/" + created.id();
        MockHttpSession stranger = new MockHttpSession();
        mvc.perform(get(path).session(stranger)).andExpect(status().isNotFound());
        mvc.perform(command(path + "/moves", stranger, MOVE)).andExpect(status().isNotFound());
        assertThat(repository.reads).isZero();
        assertThat(repository.writes).isEqualTo(1);
        assertThat(stranger.getAttribute(DameApplicationService.ATTRIBUTE)).isNull();
    }

    @Test
    void aReadWithoutSessionReturns404WithoutCreatingASession() throws Exception {
        MvcResult result = mvc.perform(get(ROOT + "/00000000-0000-0000-0000-000000000018"))
                .andExpect(status().isNotFound())
                .andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
        assertThat(repository.reads).isZero();
    }

    @Test
    void csrfIsRequiredForCreationAndMoves() throws Exception {
        mvc.perform(post(ROOT)
                        .session(owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(START))
                .andExpect(status().isForbidden());
        assertThat(repository.rows).isEmpty();
        DameGameView created = create();
        mvc.perform(post(ROOT + "/" + created.id() + "/moves")
                        .session(owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(MOVE))
                .andExpect(status().isForbidden());
        mvc.perform(post(ROOT)
                        .session(owner)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", "wrong")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(START))
                .andExpect(status().isForbidden());
        assertThat(repository.writes).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "null",
                "[]",
                "{",
                "{\"whiteName\":\"\",\"blackName\":\"Amadou\"}",
                "{\"whiteName\":\"Cherif\",\"blackName\":null}",
                "{\"whiteName\":123,\"blackName\":\"Amadou\"}",
                "{\"whiteName\":true,\"blackName\":\"Amadou\"}",
                "{\"whiteName\":\"Cherif\",\"blackName\":\"Amadou\",\"winner\":\"WHITE\"}"
            })
    void invalidOrForgedCreationBodiesAreRefusedBeforeWriting(String body) throws Exception {
        mvc.perform(command(ROOT, owner, body)).andExpect(status().isBadRequest());
        assertThat(repository.rows).isEmpty();
        assertThat(owner.getAttribute(DameApplicationService.ATTRIBUTE)).isNull();
    }

    @Test
    void namesAreLimitedAfterTrimming() throws Exception {
        String accepted = JSON.writeValueAsString(Map.of("whiteName", " " + "A".repeat(50) + " ", "blackName", "B"));
        mvc.perform(command(ROOT, owner, accepted)).andExpect(status().isCreated());
        String rejected = JSON.writeValueAsString(Map.of("whiteName", "A", "blackName", "B".repeat(51)));
        mvc.perform(command(ROOT, owner, rejected)).andExpect(status().isBadRequest());
        assertThat(repository.rows).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "null",
                "[]",
                "{\"version\":\"0\",\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":5,\"column\":0}]}",
                "{\"version\":0.5,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":5,\"column\":0}]}",
                "{\"version\":-1,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":5,\"column\":0}]}",
                "{\"version\":0,\"from\":null,\"landings\":[{\"row\":5,\"column\":0}]}",
                "{\"version\":0,\"from\":{\"row\":6.1,\"column\":1},\"landings\":[{\"row\":5,\"column\":0}]}",
                "{\"version\":0,\"from\":{\"row\":\"6\",\"column\":1},\"landings\":[{\"row\":5,\"column\":0}]}",
                "{\"version\":0,\"from\":{\"row\":6,\"column\":1},\"landings\":[]}",
                "{\"version\":0,\"from\":{\"row\":6,\"column\":1},\"landings\":[null]}",
                "{\"version\":0,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":10,\"column\":0}]}",
                "{\"version\":0,\"from\":{\"row\":6,\"column\":1,\"owner\":\"WHITE\"},\"landings\":[{\"row\":5,\"column\":0}]}",
                "{\"version\":0,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":5,\"column\":0}],\"board\":{}}"
            })
    void invalidMoveBodiesDoNotChangeTheSession(String body) throws Exception {
        DameGameView created = create();
        Object before = owner.getAttribute(DameApplicationService.ATTRIBUTE);
        mvc.perform(command(ROOT + "/" + created.id() + "/moves", owner, body)).andExpect(status().isBadRequest());
        assertThat(owner.getAttribute(DameApplicationService.ATTRIBUTE)).isEqualTo(before);
        assertThat(repository.writes).isEqualTo(1);
    }

    @Test
    void storageFailureIs502AndDoesNotLeakProviderDetails() throws Exception {
        repository.failBeforeWrite = true;
        mvc.perform(command(ROOT, owner, START))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("La rencontre n'a pas pu être enregistrée. Réessaie."))
                .andExpect(content().string(not(containsString("fournisseur"))));
        assertThat(owner.getAttribute(DameApplicationService.ATTRIBUTE)).isNull();
    }

    @Test
    void moreThanTwentyLandingsIsRefusedBeforeTheEngine() throws Exception {
        DameGameView created = create();
        String body = JSON.writeValueAsString(Map.of(
                "version",
                0,
                "from",
                Map.of("row", 6, "column", 1),
                "landings",
                java.util.Collections.nCopies(21, Map.of("row", 5, "column", 0))));
        mvc.perform(command(ROOT + "/" + created.id() + "/moves", owner, body)).andExpect(status().isBadRequest());
        assertThat(repository.writes).isEqualTo(1);
    }

    @Test
    void storesTheResultAndDoesNotAllowItsReplacementThroughHttp() throws Exception {
        DameGameView created = create();
        Game nearVictory = new Game(
                new Board(Map.of(
                        new Position(6, 1), new Piece(Player.WHITE, false),
                        new Position(5, 2), new Piece(Player.BLACK, false))),
                Player.WHITE);
        repository.fixture(DameGameView.of(repository.rows.get(created.id()), nearVictory, 0), nearVictory.drawState());
        String win = MOVE.replace("\"row\":5,\"column\":0", "\"row\":4,\"column\":3");
        String path = ROOT + "/" + created.id() + "/moves";

        mvc.perform(command(path, owner, win))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.winner").value("WHITE"))
                .andExpect(jsonPath("$.status").value("WHITE_WON"));
        assertThat(repository.rows.get(created.id()).status()).isEqualTo(GameStatus.WHITE_WON);
        mvc.perform(command(path, owner, win.replace("\"version\":0", "\"version\":1")))
                .andExpect(status().isConflict());
        assertThat(repository.writes).isEqualTo(2);
    }

    @Test
    void documentsTheThreeGamePathsAndTheirResponses() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['" + ROOT + "'].post.summary").isNotEmpty())
                .andExpect(jsonPath("$.paths['" + ROOT + "/{id}'].get.summary").isNotEmpty())
                .andExpect(jsonPath("$.paths['" + ROOT + "/{id}/moves'].post.responses['409']")
                        .exists());
    }
}
