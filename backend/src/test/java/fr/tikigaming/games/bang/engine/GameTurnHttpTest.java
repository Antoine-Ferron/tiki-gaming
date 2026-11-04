package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.cards.RoleCard;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
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
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.json.JsonCompareMode;
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

    @MockitoSpyBean
    private InitialDeal deal;

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

    @ParameterizedTest
    @ValueSource(strings = {"draw", "end", "discard/test-card-1"})
    void turnCommandsRequireTheActiveSessionAndCsrf(String command) throws Exception {
        String code = startedTable();
        var original = tables.game(code);
        String path = TABLES + "/" + code + "/turn/" + command;

        postAs(path, new MockHttpSession())
                .andExpect(status().isUnauthorized())
                .andExpect(content().json("{\"error\":\"Non connecté\"}", JsonCompareMode.STRICT));
        postAs(path, sessionFor(5))
                .andExpect(status().isForbidden())
                .andExpect(content().json("{\"error\":\"Tu dois être assis à cette table.\"}", JsonCompareMode.STRICT));
        mvc.perform(preparePost(path, sessionFor(2)).param("seat", "1").param("accountId", accountPrefix + ":player-1"))
                .andExpect(status().isForbidden())
                .andExpect(content().json("{\"error\":\"Ce n'est pas ton tour.\"}", JsonCompareMode.STRICT));
        mvc.perform(post(path).session(sessionFor(1))).andExpect(status().isForbidden());
        mvc.perform(post(path)
                        .session(sessionFor(1))
                        .cookie(new Cookie("XSRF-TOKEN", "correct"))
                        .header("X-XSRF-TOKEN", "incorrect"))
                .andExpect(status().isForbidden());

        assertThat(tables.game(code)).isSameAs(original);
    }

    @ParameterizedTest
    @ValueSource(strings = {"draw", "end", "discard/test-card-1"})
    void unknownAndUnstartedTablesRefuseTurnCommands(String command) throws Exception {
        postAs(TABLES + "/INCONNUE/turn/" + command, sessionFor(1))
                .andExpect(status().isNotFound())
                .andExpect(content().json("{\"error\":\"Code de table inconnu.\"}", JsonCompareMode.STRICT));
        String code = fullTable();
        postAs(TABLES + "/" + code + "/turn/" + command, sessionFor(1))
                .andExpect(status().isConflict())
                .andExpect(content().json("{\"error\":\"La partie n'a pas encore démarré.\"}", JsonCompareMode.STRICT));
        postAs(TABLES + "/" + code + "/turn/" + command, sessionFor(5)).andExpect(status().isForbidden());
        assertThat(tables.game(code)).isNull();
    }

    @Test
    void incoherentTransitionsLeaveTheEntireStateUnchanged() throws Exception {
        String code = startedTable();
        GameState initial = tables.game(code);
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isConflict());
        postAs(TABLES + "/" + code + "/turn/discard/test-card-1", sessionFor(1)).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(initial);

        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isNoContent());
        GameState playing = tables.game(code);
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isConflict());
        postAs(TABLES + "/" + code + "/turn/discard/test-card-1", sessionFor(1)).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(playing);

        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());
        GameState discarding = tables.game(code);
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isConflict());
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(discarding);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1})
    void insufficientDrawPilesRefuseWithoutPartialDrawingOrRecycling(int remaining) throws Exception {
        List<CardInstance> drawPile = new TestGameCatalog().cards().subList(0, remaining);
        GameState game = new GameState(
                List.of(player(1, 2, 1), player(2, 4, 1), player(3, 3, 1), player(4, 4, 1)),
                drawPile,
                List.of(new CardInstance("already-discarded", CardType.MISSED)),
                1,
                GameState.Phase.DRAW);
        doReturn(game).when(deal).deal(anyList());
        String code = startedTable();

        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1))
                .andExpect(status().isConflict())
                .andExpect(content()
                        .json("{\"error\":\"Il reste moins de deux cartes dans la pioche.\"}", JsonCompareMode.STRICT));

        assertThat(tables.game(code)).isSameAs(game);
        assertThat(game.players().getFirst().hand()).hasSize(1);
        assertThat(game.drawPile()).hasSize(remaining);
        assertThat(game.discardPile()).hasSize(1);
    }

    @Test
    void endingPlayWithTooManyCardsRequiresDiscardingBeforeEndingTheTurn() throws Exception {
        String code = startedTable();
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isNoContent());

        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentSeat").value(1))
                .andExpect(jsonPath("$.phase").value("DISCARD"))
                .andExpect(jsonPath("$.hand.length()").value(7));

        var beforeRefusal = tables.game(code);
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(beforeRefusal);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 2})
    void endingPlayAtOrBelowCurrentHealthStartsTheNextLivingPlayersTurn(int handSize) throws Exception {
        GameState game = new GameState(
                List.of(player(1, 2, handSize), player(2, 4, 1), player(3, 3, 1), player(4, 4, 1)),
                List.of(),
                List.of(),
                1,
                GameState.Phase.PLAY);
        doReturn(game).when(deal).deal(anyList());
        String code = startedTable();

        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());

        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentSeat").value(2))
                .andExpect(jsonPath("$.phase").value("DRAW"))
                .andExpect(jsonPath("$.hand[0].id").value("seat-2-card-0"));
    }

    @Test
    void theDiscardLimitUsesCurrentHealthRatherThanMaximumHealth() throws Exception {
        GameState game = new GameState(
                List.of(player(1, 2, 3), player(2, 4, 1), player(3, 3, 1), player(4, 4, 1)),
                List.of(),
                List.of(),
                1,
                GameState.Phase.PLAY);
        doReturn(game).when(deal).deal(anyList());
        String code = startedTable();

        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());
        assertThat(tables.game(code).phase()).isEqualTo(GameState.Phase.DISCARD);
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isConflict());
        postAs(TABLES + "/" + code + "/turn/discard/seat-1-card-1", sessionFor(1))
                .andExpect(status().isNoContent());
        assertThat(tables.game(code).phase()).isEqualTo(GameState.Phase.DISCARD);
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());
        assertThat(tables.game(code).currentSeat()).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4})
    void theNextSeatFollowsTheCircularSeatOrder(int activeSeat) throws Exception {
        GameState game = new GameState(
                List.of(player(1, 2, 0), player(2, 4, 0), player(3, 3, 0), player(4, 4, 0)),
                List.of(),
                List.of(),
                activeSeat,
                GameState.Phase.PLAY);
        doReturn(game).when(deal).deal(anyList());
        String code = startedTable();

        postAs(TABLES + "/" + code + "/turn/end", sessionFor(activeSeat)).andExpect(status().isNoContent());

        assertThat(tables.game(code).currentSeat()).isEqualTo(activeSeat % 4 + 1);
        assertThat(tables.game(code).phase()).isEqualTo(GameState.Phase.DRAW);
    }

    @Test
    void theOnlyLivingPlayerStartsAnotherTurnWithoutAddingVictoryRules() throws Exception {
        GameState game = new GameState(
                List.of(player(1, 0, 0), player(2, 0, 0), player(3, 3, 0), player(4, 0, 0)),
                List.of(),
                List.of(),
                3,
                GameState.Phase.PLAY);
        doReturn(game).when(deal).deal(anyList());
        String code = startedTable();

        postAs(TABLES + "/" + code + "/turn/end", sessionFor(3)).andExpect(status().isNoContent());

        assertThat(tables.game(code).currentSeat()).isEqualTo(3);
        assertThat(tables.game(code).phase()).isEqualTo(GameState.Phase.DRAW);
    }

    @Test
    void turnCommandsNormalizeTheTableCodeLikeJoining() throws Exception {
        String code = startedTable();
        String entered = "  " + code.toLowerCase(Locale.ROOT) + "  ";
        postAs(TABLES + "/{code}/turn/draw", sessionFor(1), entered).andExpect(status().isNoContent());
        postAs(TABLES + "/{code}/turn/end", sessionFor(1), entered).andExpect(status().isNoContent());
        postAs(TABLES + "/{code}/turn/discard/test-card-1", sessionFor(1), entered)
                .andExpect(status().isNoContent());
        assertThat(tables.state(code, accountPrefix + ":player-1").code()).isEqualTo(code);
    }

    @Test
    void endingTheTurnSkipsEliminatedSeatsAndWrapsAroundTheTable() throws Exception {
        GameState game = new GameState(
                List.of(player(1, 0, 0), player(2, 3, 0), player(3, 2, 1), player(4, 0, 0)),
                List.of(),
                List.of(),
                3,
                GameState.Phase.PLAY);
        doReturn(game).when(deal).deal(anyList());
        String code = startedTable();

        postAs(TABLES + "/" + code + "/turn/end", sessionFor(3)).andExpect(status().isNoContent());

        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentSeat").value(2))
                .andExpect(jsonPath("$.phase").value("DRAW"));
    }

    @Test
    void chosenCardsLeaveOnlyTheActiveHandBeforeTheNextTurn() throws Exception {
        String code = startedTable();
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isNoContent());
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());

        postAs(TABLES + "/" + code + "/turn/discard/test-card-2", sessionFor(1)).andExpect(status().isNoContent());
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phase").value("DISCARD"))
                .andExpect(jsonPath("$.hand.length()").value(6));
        var afterFirst = tables.game(code);
        postAs(TABLES + "/" + code + "/turn/discard/test-card-2", sessionFor(1)).andExpect(status().isConflict());
        postAs(TABLES + "/" + code + "/turn/discard/test-card-6", sessionFor(1)).andExpect(status().isConflict());
        postAs(TABLES + "/" + code + "/turn/discard/inconnue", sessionFor(1)).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(afterFirst);

        postAs(TABLES + "/" + code + "/turn/discard/test-card-17", sessionFor(1))
                .andExpect(status().isNoContent());
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentSeat").value(2))
                .andExpect(jsonPath("$.phase").value("DRAW"))
                .andExpect(jsonPath("$.hand.length()").value(4))
                .andExpect(jsonPath("$.hand[0].id").value("test-card-6"))
                .andExpect(jsonPath("$.players[0].handCount").value(5));
        assertThat(tables.game(code).discardPile())
                .extracting(CardInstance::id)
                .containsExactly("test-card-2", "test-card-17");
        assertCardPartition(tables.game(code));
    }

    @Test
    void simultaneousDrawsRefreshesNewSessionsAndRepeatedStartsKeepOneDraw() throws Exception {
        String code = startedTable();
        var outcomes = simultaneously(
                preparePost(TABLES + "/" + code + "/turn/draw", sessionFor(1)),
                preparePost(TABLES + "/" + code + "/turn/draw", sessionFor(1)));

        assertThat(outcomes)
                .extracting(result -> result.getResponse().getStatus())
                .containsExactlyInAnyOrder(204, 409);
        GameState drawn = tables.game(code);
        assertThat(drawn.players().getFirst().hand())
                .extracting(CardInstance::id)
                .containsExactly(
                        "test-card-1",
                        "test-card-2",
                        "test-card-3",
                        "test-card-4",
                        "test-card-5",
                        "test-card-17",
                        "test-card-18");
        assertThat(drawn.drawPile())
                .containsExactlyElementsOf(new TestGameCatalog().cards().subList(18, 40));
        String firstView = mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        for (int read = 0; read < 3; read++) {
            mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(1)))
                    .andExpect(status().isOk())
                    .andExpect(content().string(firstView));
        }
        postAs(TABLES + "/" + code + "/start", sessionFor(4)).andExpect(status().isOk());
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(drawn);
        assertCardPartition(drawn);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void simultaneousDiscardsMoveEachChosenCardExactlyOnce(boolean sameCard) throws Exception {
        String code = startedTable();
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isNoContent());
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());
        List<CardInstance> drawPile = tables.game(code).drawPile();

        var outcomes = simultaneously(
                preparePost(TABLES + "/" + code + "/turn/discard/test-card-2", sessionFor(1)),
                preparePost(
                        TABLES + "/" + code + "/turn/discard/" + (sameCard ? "test-card-2" : "test-card-17"),
                        sessionFor(1)));

        assertThat(outcomes)
                .extracting(result -> result.getResponse().getStatus())
                .containsExactlyInAnyOrder(204, sameCard ? 409 : 204);
        GameState result = tables.game(code);
        assertThat(result.players().getFirst().hand()).hasSize(sameCard ? 6 : 5);
        assertThat(result.discardPile())
                .extracting(CardInstance::id)
                .containsExactlyInAnyOrderElementsOf(
                        sameCard ? List.of("test-card-2") : List.of("test-card-2", "test-card-17"));
        assertThat(result.drawPile()).isEqualTo(drawPile);
        assertThat(result.phase()).isEqualTo(GameState.Phase.DISCARD);
        assertCardPartition(result);
    }

    @Test
    void simultaneousEndRequestsAdvanceOnlyOneTurn() throws Exception {
        GameState game = new GameState(
                List.of(player(1, 2, 0), player(2, 4, 0), player(3, 3, 0), player(4, 4, 0)),
                List.of(),
                List.of(),
                1,
                GameState.Phase.PLAY);
        doReturn(game).when(deal).deal(anyList());
        String code = startedTable();

        var outcomes = simultaneously(
                preparePost(TABLES + "/" + code + "/turn/end", sessionFor(1)),
                preparePost(TABLES + "/" + code + "/turn/end", sessionFor(1)));

        assertThat(outcomes)
                .extracting(result -> result.getResponse().getStatus())
                .containsExactlyInAnyOrder(204, 403);
        assertThat(tables.game(code).currentSeat()).isEqualTo(2);
        assertThat(tables.game(code).phase()).isEqualTo(GameState.Phase.DRAW);
    }

    @Test
    void privateViewsStayPrivateAcrossPhaseAndHandChanges() throws Exception {
        String code = startedTable();
        postAs(TABLES + "/" + code + "/turn/draw", sessionFor(1)).andExpect(status().isNoContent());
        assertSecondView(code, 1, "PLAY", 7);
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());
        assertSecondView(code, 1, "DISCARD", 7);
        postAs(TABLES + "/" + code + "/turn/discard/test-card-2", sessionFor(1)).andExpect(status().isNoContent());
        assertSecondView(code, 1, "DISCARD", 6);
        postAs(TABLES + "/" + code + "/turn/discard/test-card-17", sessionFor(1))
                .andExpect(status().isNoContent());
        assertSecondView(code, 1, "DISCARD", 5);
        GameState beforeStart = tables.game(code);
        postAs(TABLES + "/" + code + "/start", sessionFor(1)).andExpect(status().isOk());
        assertThat(tables.game(code)).isSameAs(beforeStart);
        postAs(TABLES + "/" + code + "/turn/end", sessionFor(1)).andExpect(status().isNoContent());
        assertSecondView(code, 2, "DRAW", 5);
    }

    private void assertSecondView(String code, int activeSeat, String phase, int sheriffHandCount) throws Exception {
        mvc.perform(get(TABLES + "/{code}/state", code)
                        .session(sessionFor(2))
                        .param("seat", "1")
                        .param("accountId", accountPrefix + ":player-1"))
                .andExpect(status().isOk())
                .andExpect(content()
                        .json("""
                        {"code":"%s","seat":2,"currentSeat":%d,"phase":"%s","role":"OUTLAW",
                         "hand":[{"id":"test-card-6","type":"MISSED"},{"id":"test-card-7","type":"BANG"},
                                 {"id":"test-card-8","type":"MISSED"},{"id":"test-card-9","type":"BANG"}],
                         "players":[
                           {"seat":1,"character":"BART_CASSIDY","health":5,"maxHealth":5,
                            "playedCards":[],"handCount":%d,"role":"SHERIFF"},
                           {"seat":2,"character":"CALAMITY_JANET","health":4,"maxHealth":4,
                            "playedCards":[],"handCount":4},
                           {"seat":3,"character":"PAUL_REGRET","health":3,"maxHealth":3,
                            "playedCards":[],"handCount":3},
                           {"seat":4,"character":"WILLY_THE_KID","health":4,"maxHealth":4,
                            "playedCards":[],"handCount":4}
                         ]}
                        """.formatted(code, activeSeat, phase, sheriffHandCount), JsonCompareMode.STRICT));
    }

    private static void assertCardPartition(GameState game) {
        List<CardInstance> allCards = new ArrayList<>(game.drawPile());
        allCards.addAll(game.discardPile());
        game.players().forEach(player -> allCards.addAll(player.hand()));
        assertThat(allCards).extracting(CardInstance::id).doesNotHaveDuplicates();
        assertThat(allCards).containsExactlyInAnyOrderElementsOf(new TestGameCatalog().cards());
    }

    private List<MvcResult> simultaneously(
            MockHttpServletRequestBuilder firstRequest, MockHttpServletRequestBuilder secondRequest) throws Exception {
        CyclicBarrier start = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await(5, TimeUnit.SECONDS);
                return mvc.perform(firstRequest).andReturn();
            });
            var second = executor.submit(() -> {
                start.await(5, TimeUnit.SECONDS);
                return mvc.perform(secondRequest).andReturn();
            });
            return List.of(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS));
        }
    }

    private GameState.Player player(int seat, int health, int handSize) {
        return new GameState.Player(
                accountPrefix + ":player-" + seat,
                seat,
                new RoleCard(seat == 1 ? Role.SHERIFF : Role.OUTLAW, seat == 1),
                BangCharacter.BART_CASSIDY,
                health,
                5,
                IntStream.range(0, handSize)
                        .mapToObj(index -> new CardInstance("seat-" + seat + "-card-" + index, CardType.BANG))
                        .toList());
    }

    private String startedTable() throws Exception {
        String code = fullTable();
        postAs(TABLES + "/" + code + "/start", sessionFor(1)).andExpect(status().isOk());
        return code;
    }

    private String fullTable() throws Exception {
        String body = postAs(TABLES, sessionFor(1))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String code = json.readTree(body).path("code").asString();
        for (int seat = 2; seat <= 4; seat++) {
            postAs(TABLES + "/" + code + "/join", sessionFor(seat)).andExpect(status().isOk());
        }
        return code;
    }

    private ResultActions postAs(String path, MockHttpSession session, Object... variables) throws Exception {
        return mvc.perform(preparePost(path, session, variables));
    }

    private MockHttpServletRequestBuilder preparePost(String path, MockHttpSession session, Object... variables)
            throws Exception {
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        return post(path, variables).session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
    }

    private MockHttpSession sessionFor(int seat) {
        String accountId = accountPrefix + ":player-" + seat;
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountId, "player-" + seat + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
