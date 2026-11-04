package fr.tikigaming.games.bang.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
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
class PrivateTablesHttpTest {

    private static final String TABLES = "/api/games/bang/tables";

    private final String accountPrefix = UUID.randomUUID().toString();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Test
    void anonymousPlayersCannotReadATableState() throws Exception {
        mvc.perform(get(TABLES + "/UNKNOWN/state"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Non connecté"));
    }

    @Test
    void readingAnUnknownTableIsRefused() throws Exception {
        mvc.perform(get(TABLES + "/UNKNOWN/state").session(sessionFor("player")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Code de table inconnu."));
    }

    @Test
    void anOutsiderCannotReadAnExistingTableBeforeOrAfterItStarts() throws Exception {
        String code = createTable("creator");
        for (int seat = 2; seat <= 4; seat++) {
            postAs(TABLES + "/" + code + "/join", sessionFor("player-" + seat)).andExpect(status().isOk());
        }

        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor("outsider")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Tu dois être assis à cette table pour consulter la partie."));
        postAs(TABLES + "/" + code + "/start", sessionFor("creator")).andExpect(status().isOk());
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor("outsider")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Tu dois être assis à cette table pour consulter la partie."));
    }

    @Test
    void aMemberCannotReadBeforeTheGameStarts() throws Exception {
        String code = createTable("creator");

        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor("creator")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("La partie n'a pas encore démarré."));
    }

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
    void anUnseatedAccountCannotStartAFullTable() throws Exception {
        String code = createTable("creator");
        for (int seat = 2; seat <= 4; seat++) {
            postAs(TABLES + "/" + code + "/join", sessionFor("player-" + seat)).andExpect(status().isOk());
        }

        postAs(TABLES + "/" + code + "/start", sessionFor("outsider"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Tu dois être assis à cette table pour démarrer la partie."));
    }

    @Test
    void startingAnUnknownTableIsRefused() throws Exception {
        postAs(TABLES + "/UNKNOWN/start", sessionFor("player"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Code de table inconnu."));
    }

    @Test
    void visitorsCannotStartATableEvenWithAValidCsrfToken() throws Exception {
        postAs(TABLES + "/UNKNOWN/start", new MockHttpSession())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Non connecté"));
    }

    @Test
    void fullTablesStartWithTheProductionCatalogue() throws Exception {
        String code = createTable("creator");
        for (int seat = 2; seat <= 4; seat++) {
            postAs(TABLES + "/" + code + "/join", sessionFor("player-" + seat)).andExpect(status().isOk());
        }

        for (int attempt = 0; attempt < 2; attempt++) {
            postAs(TABLES + "/" + code + "/start", sessionFor("creator"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(code))
                    .andExpect(jsonPath("$.currentSeat").isNumber());
        }
    }

    @Test
    void fourPlayersReadTheirViewsThroughTheProductionComponentsAndCatalogue() throws Exception {
        String code = createTable("player-1");
        for (int seat = 2; seat <= 4; seat++) {
            postAs(TABLES + "/" + code + "/join", sessionFor("player-" + seat)).andExpect(status().isOk());
        }
        postAs(TABLES + "/" + code + "/start", sessionFor("player-1")).andExpect(status().isOk());

        var cardIds = new HashSet<String>();
        var roles = new ArrayList<String>();
        JsonNode publicPlayers = null;
        for (int seat = 1; seat <= 4; seat++) {
            String body = mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor("player-" + seat)))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            JsonNode view = json.readTree(body);
            assertFields(view, "code", "seat", "currentSeat", "phase", "role", "hand", "players");
            assertThat(view.path("code").asString()).isEqualTo(code);
            assertThat(view.path("seat").asInt()).isEqualTo(seat);
            assertThat(view.path("phase").asString()).isEqualTo("DRAW");
            roles.add(view.path("role").asString());
            assertThat(view.path("players")).hasSize(4);
            if (publicPlayers == null) publicPlayers = view.path("players");
            else assertThat(view.path("players")).isEqualTo(publicPlayers);

            int sheriffSeat = view.path("currentSeat").asInt();
            assertThat(sheriffSeat).isBetween(1, 4);
            for (int index = 0; index < 4; index++) {
                JsonNode player = view.path("players").get(index);
                if (index + 1 == sheriffSeat) {
                    assertFields(
                            player, "seat", "character", "health", "maxHealth", "playedCards", "handCount", "role");
                    assertThat(player.path("role").asString()).isEqualTo("SHERIFF");
                } else {
                    assertFields(player, "seat", "character", "health", "maxHealth", "playedCards", "handCount");
                }
                assertThat(player.path("seat").asInt()).isEqualTo(index + 1);
                assertThat(player.path("playedCards")).isEmpty();
            }
            assertThat(view.path("hand"))
                    .hasSize(
                            view.path("players").get(seat - 1).path("handCount").asInt());
            for (JsonNode card : view.path("hand")) {
                assertFields(card, "id", "type");
                String id = card.path("id").asString();
                String type = card.path("type").asString();
                assertThat(type).isIn("BANG", "MISSED");
                assertThat(id).matches(type + "-[1-9][0-9]*");
                int number = Integer.parseInt(id.substring(type.length() + 1));
                assertThat(number).isBetween(1, type.equals("BANG") ? 25 : 12);
                assertThat(cardIds.add(id)).isTrue();
            }
        }
        assertThat(roles).containsExactlyInAnyOrder("SHERIFF", "OUTLAW", "OUTLAW", "RENEGADE");
        assertThat(cardIds).hasSize(16);
    }

    private static void assertFields(JsonNode node, String... fields) {
        assertThat(node.size()).isEqualTo(fields.length);
        for (String field : fields) {
            assertThat(node.has(field)).as("Champ attendu : %s", field).isTrue();
        }
    }

    @Test
    void swaggerDocumentsThePrivateViewAndItsAccessErrors() throws Exception {
        String path = "$.paths['" + TABLES + "/{code}/state'].get";
        ResultActions docs = mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(path + ".tags[0]").value("bang"))
                .andExpect(jsonPath(path + ".summary", not(emptyOrNullString())))
                .andExpect(jsonPath(path + ".description", containsString("ne renouvelle pas")))
                .andExpect(jsonPath(path + ".parameters[*].name", org.hamcrest.Matchers.contains("code")))
                .andExpect(jsonPath(path + ".responses['200'].content['*/*'].schema['$ref']")
                        .value("#/components/schemas/PlayerGameView"))
                .andExpect(jsonPath(
                        "$.components.schemas.PlayerGameView.properties", org.hamcrest.Matchers.aMapWithSize(8)))
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.code")
                        .exists())
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.seat")
                        .exists())
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.currentSeat")
                        .exists())
                .andExpect(jsonPath(
                        "$.components.schemas.PlayerGameView.properties.phase.enum",
                        org.hamcrest.Matchers.contains("DRAW", "PLAY", "DISCARD")))
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.role")
                        .exists())
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.hand")
                        .exists())
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.players")
                        .exists())
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.role.description")
                        .value("Rôle privé du compte connecté"))
                .andExpect(jsonPath(
                        "$.components.schemas.PlayerGameView.properties.role.enum",
                        org.hamcrest.Matchers.hasItems("SHERIFF", "OUTLAW", "RENEGADE")))
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.hand.description")
                        .value("Cartes en main du compte connecté uniquement"))
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.players.items['$ref']")
                        .value("#/components/schemas/Player"))
                .andExpect(jsonPath("$.components.schemas.Player.properties", org.hamcrest.Matchers.aMapWithSize(7)))
                .andExpect(jsonPath(
                        "$.components.schemas.Player.properties.role.enum", org.hamcrest.Matchers.contains("SHERIFF")))
                .andExpect(jsonPath("$.components.schemas.Player.properties.playedCards.description")
                        .value("Cartes posées, toujours vide au démarrage"))
                .andExpect(jsonPath("$.components.schemas.PlayerGameView.properties.hand.items['$ref']")
                        .value("#/components/schemas/BangCard"))
                .andExpect(jsonPath("$.components.schemas.BangCard.properties", org.hamcrest.Matchers.aMapWithSize(2)))
                .andExpect(
                        jsonPath("$.components.schemas.BangCard.properties.id").exists())
                .andExpect(jsonPath("$.components.schemas.BangCard.properties.type")
                        .exists());

        for (int error : List.of(401, 403, 404, 409)) {
            docs.andExpect(jsonPath(path + ".responses['" + error + "'].content.*.schema['$ref']")
                    .value(org.hamcrest.Matchers.hasItem("#/components/schemas/ApiError")));
        }
    }

    @Test
    void swaggerDocumentsStartingWithoutExposingTheServerState() throws Exception {
        String path = "$.paths['" + TABLES + "/{code}/start'].post";
        ResultActions docs = mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(path + ".tags[0]").value("bang"))
                .andExpect(jsonPath(path + ".summary", not(emptyOrNullString())))
                .andExpect(jsonPath(path + ".responses['200'].content['*/*'].schema['$ref']")
                        .value("#/components/schemas/GameStarted"))
                .andExpect(jsonPath("$.components.schemas.GameStarted.properties.*", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$.components.schemas.GameStarted.properties.code")
                        .exists())
                .andExpect(jsonPath("$.components.schemas.GameStarted.properties.currentSeat")
                        .exists())
                .andExpect(jsonPath(path + ".responses['503']").doesNotExist())
                .andExpect(jsonPath(path + ".responses['403'].content['application/json'].schema.anyOf[*]['$ref']")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "#/components/schemas/ApiError", "#/components/schemas/CsrfErrorResponse")));

        for (int error : List.of(401, 404, 409)) {
            docs.andExpect(jsonPath(path + ".responses['" + error + "'].content.*.schema['$ref']")
                    .value(org.hamcrest.Matchers.hasItem("#/components/schemas/ApiError")));
        }
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
    void aCreatorCannotAllocateAnotherTableEvenWithANewSession() throws Exception {
        MockHttpSession originalSession = sessionFor("creator");
        String code = createTable(originalSession);

        for (MockHttpSession session : List.of(originalSession, sessionFor("creator"))) {
            postAs(TABLES, session)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error").value("Tu as déjà une table privée ouverte."));
        }
        postAs(TABLES + "/" + code + "/join", sessionFor("creator"))
                .andExpect(status().isOk())
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

    @ParameterizedTest
    @ValueSource(strings = {"%s", "  %s  "})
    void sharedCodesIgnoreLetterCaseAndOuterSpaces(String format) throws Exception {
        String code = createTable("creator");
        String enteredCode = format.formatted(code.toLowerCase(Locale.ROOT));

        for (int attempt = 0; attempt < 2; attempt++) {
            postAs(TABLES + "/{code}/join", sessionFor("second"), enteredCode)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(code))
                    .andExpect(jsonPath("$.seat").value(2))
                    .andExpect(jsonPath("$.playerCount").value(2));
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
    @ValueSource(strings = {TABLES, TABLES + "/UNKNOWN/join", TABLES + "/UNKNOWN/start"})
    void connectedPlayersMustSendACsrfToken(String path) throws Exception {
        mvc.perform(post(path).session(sessionFor("player"))).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {TABLES, TABLES + "/UNKNOWN/join", TABLES + "/UNKNOWN/start"})
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
                .andExpect(jsonPath("$.paths['" + TABLES + "'].post.description")
                        .value(containsString(
                                "La table et sa partie expirent après 1 h sans opération acceptée : création, jonction, démarrage, action de tour, tir ou réponse. "
                                        + "Les lectures et les actions refusées ne renouvellent pas ce délai.")))
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
        for (int error : List.of(409, 503)) {
            docs.andExpect(
                    jsonPath("$.paths['" + TABLES + "'].post.responses['" + error + "'].content.*.schema['$ref']")
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

    private ResultActions postAs(String path, MockHttpSession session, Object... uriVariables) throws Exception {
        return mvc.perform(preparePost(path, session, uriVariables));
    }

    private MockHttpServletRequestBuilder preparePost(String path, MockHttpSession session, Object... uriVariables)
            throws Exception {
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        return post(path, uriVariables).session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
    }

    private MockHttpSession sessionFor(String accountId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountPrefix + ":" + accountId, accountId + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
