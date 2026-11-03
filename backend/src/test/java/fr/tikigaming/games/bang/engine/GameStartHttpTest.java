package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
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
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
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
@Import(GameStartHttpTest.Setup.class)
class GameStartHttpTest {
    private static final String TABLES = "/api/games/bang/tables";
    private final String accountPrefix = UUID.randomUUID().toString();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private PrivateTableService tables;

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
        PrivateTableService timedTables(InitialDeal initialDeal, MutableClock clock) {
            return new PrivateTableService(initialDeal, clock);
        }

        @Bean
        @Primary
        InitialDeal orderedDeal(GameCatalog catalog) {
            return new InitialDeal(catalog, list -> {
                if (!(list.getFirst() instanceof BangCharacter)) Collections.rotate(list, 2);
            });
        }
    }

    @Test
    void aSeatedPlayerStartsAFullTableWithoutReceivingPrivateCards() throws Exception {
        String code = fullTable();

        postAs(TABLES + "/" + code + "/start", sessionFor("third"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"code\":\"" + code + "\",\"currentSeat\":3}", JsonCompareMode.STRICT));

        GameState game = tables.game(code);
        assertThat(game.players())
                .extracting(player -> player.roleCard().role())
                .containsExactlyInAnyOrder(Role.SHERIFF, Role.OUTLAW, Role.OUTLAW, Role.RENEGADE);
        assertThat(game.players())
                .extracting(GameState.Player::character)
                .doesNotHaveDuplicates()
                .hasSize(4);
        assertThat(game.players())
                .allSatisfy(player -> assertThat(player.roleCard().faceUp())
                        .isEqualTo(player.roleCard().role() == Role.SHERIFF));
    }

    @Test
    void startingGivesEachCharacterItsHealthAndAddsTheSheriffBonus() throws Exception {
        String code = fullTable();

        postAs(TABLES + "/" + code + "/start", sessionFor("second")).andExpect(status().isOk());

        for (GameState.Player player : tables.game(code).players()) {
            int expected = player.character().lifePoints() + (player.roleCard().role() == Role.SHERIFF ? 1 : 0);
            assertThat(player.health()).isEqualTo(expected);
            assertThat(player.maxHealth()).isEqualTo(expected);
        }
        GameState.Player paul = tables.game(code).players().get(2);
        assertThat(paul.character()).isEqualTo(BangCharacter.PAUL_REGRET);
        assertThat(paul.roleCard().role()).isEqualTo(Role.SHERIFF);
        assertThat(paul.health()).isEqualTo(4);
        assertThat(paul.maxHealth()).isEqualTo(4);
    }

    @Test
    void startingDealsOneCommonDeckWithoutDuplicatingCardsOrDrawingForTheFirstTurn() throws Exception {
        String code = fullTable();

        postAs(TABLES + "/" + code + "/start", sessionFor("fourth")).andExpect(status().isOk());

        GameState game = tables.game(code);
        List<CardInstance> allCards = new ArrayList<>(game.drawPile());
        for (GameState.Player player : game.players()) {
            assertThat(player.hand()).hasSize(player.health());
            allCards.addAll(player.hand());
        }
        assertThat(game.players().get(2).hand()).hasSize(4);
        assertThat(game.drawPile()).hasSize(21);
        assertThat(allCards).extracting(CardInstance::id).doesNotHaveDuplicates();
        assertThat(allCards).containsExactlyInAnyOrderElementsOf(new BangGameCatalog().cards());
    }

    @Test
    void paulRegretAsSheriffInTheThirdSeatStartsWithFourHealthFourCardsAndTheFirstTurn() throws Exception {
        String code = fullTable();

        postAs(TABLES + "/" + code + "/start", sessionFor("creator")).andExpect(status().isOk());

        GameState game = tables.game(code);
        GameState.Player paul = game.players().get(2);
        assertThat(paul.character()).isEqualTo(BangCharacter.PAUL_REGRET);
        assertThat(paul.roleCard().role()).isEqualTo(Role.SHERIFF);
        assertThat(paul.health()).isEqualTo(4);
        assertThat(paul.maxHealth()).isEqualTo(4);
        assertThat(paul.hand()).hasSize(4);
        assertThat(game.currentSeat()).isEqualTo(3);
        assertThat(game.drawPile()).hasSize(21);
    }

    @Test
    void anotherSeatedAccountWithANewSessionKeepsExactlyTheSameDeal() throws Exception {
        String code = fullTable();
        postAs(TABLES + "/" + code + "/start", sessionFor("creator")).andExpect(status().isOk());
        GameState first = tables.game(code);

        postAs(TABLES + "/" + code + "/start", sessionFor("third"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"code\":\"" + code + "\",\"currentSeat\":3}", JsonCompareMode.STRICT));

        assertThat(tables.game(code)).isSameAs(first);
        assertThat(tables.game(code).drawPile()).hasSize(21);
    }

    @Test
    void simultaneousHttpRequestsStartASingleDealWithoutRevealingHiddenCards() throws Exception {
        String code = fullTable();
        var firstRequest = preparePost(TABLES + "/" + code + "/start", sessionFor("second"));
        var secondRequest = preparePost(TABLES + "/" + code + "/start", sessionFor("fourth"));
        CyclicBarrier start = new CyclicBarrier(2);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> startTogether(firstRequest, start));
            var second = executor.submit(() -> startTogether(secondRequest, start));
            for (MvcResult response : List.of(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS))) {
                assertThat(response.getResponse().getStatus()).isEqualTo(200);
                content()
                        .json("{\"code\":\"" + code + "\",\"currentSeat\":3}", JsonCompareMode.STRICT)
                        .match(response);
            }
        }
        GameState first = tables.game(code);
        postAs(TABLES + "/" + code + "/start", sessionFor("creator")).andExpect(status().isOk());
        assertThat(tables.game(code)).isSameAs(first);
        assertThat(first.drawPile()).hasSize(21);
        assertThat(first.players())
                .allSatisfy(player -> assertThat(player.hand()).hasSize(player.health()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"%s", "  %s  "})
    void startingFindsTheSameTableAsJoiningAndReturnsItsCanonicalCode(String format) throws Exception {
        String code = fullTable();
        String entered = format.formatted(code.toLowerCase(Locale.ROOT));
        postAs(TABLES + "/{code}/join", sessionFor("second"), entered)
                .andExpect(status().isOk())
                .andExpect(content()
                        .json("{\"code\":\"" + code + "\",\"seat\":2,\"playerCount\":4}", JsonCompareMode.STRICT));

        postAs(TABLES + "/{code}/start", sessionFor("third"), entered)
                .andExpect(status().isOk())
                .andExpect(content().json("{\"code\":\"" + code + "\",\"currentSeat\":3}", JsonCompareMode.STRICT));
        GameState first = tables.game(code);
        postAs(TABLES + "/{code}/start", sessionFor("creator"), code).andExpect(status().isOk());
        assertThat(tables.game(code)).isSameAs(first);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/start", "/join"})
    void anHourOfInactivityExpiresBothTheTableAndItsDeal(String operation) throws Exception {
        String code = fullTable();
        postAs(TABLES + "/{code}/start", sessionFor("creator"), code).andExpect(status().isOk());
        assertThat(tables.game(code)).isNotNull();
        clock.advance(Duration.ofHours(1));

        postAs(TABLES + "/{code}" + operation, sessionFor("creator"), code)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Code de table inconnu."));

        assertThat(tables.game(code)).isNull();
        postAs(TABLES + "/{code}/start", sessionFor("creator"), code).andExpect(status().isNotFound());
        String body = postAs(TABLES, sessionFor("creator"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(json.readTree(body).path("code").asString()).isNotEqualTo(code);
    }

    @Test
    void successfulStartsKeepTheTableAndTheSameDealAlive() throws Exception {
        String code = fullTable();
        clock.advance(Duration.ofMinutes(59));
        postAs(TABLES + "/{code}/start", sessionFor("third"), code).andExpect(status().isOk());
        GameState first = tables.game(code);
        clock.advance(Duration.ofMinutes(59));

        postAs(TABLES + "/{code}/join", sessionFor("creator"), code).andExpect(status().isOk());

        assertThat(tables.game(code)).isSameAs(first);
    }

    @Test
    void aRefusedStartDoesNotKeepTheTableOrItsDealAlive() throws Exception {
        String code = fullTable();
        postAs(TABLES + "/{code}/start", sessionFor("creator"), code).andExpect(status().isOk());
        clock.advance(Duration.ofMinutes(59));
        postAs(TABLES + "/{code}/start", sessionFor("outsider"), code).andExpect(status().isForbidden());
        clock.advance(Duration.ofMinutes(1));

        postAs(TABLES + "/{code}/join", sessionFor("creator"), code).andExpect(status().isNotFound());

        assertThat(tables.game(code)).isNull();
    }

    private MvcResult startTogether(MockHttpServletRequestBuilder request, CyclicBarrier start) throws Exception {
        start.await(5, TimeUnit.SECONDS);
        return mvc.perform(request).andReturn();
    }

    private String fullTable() throws Exception {
        String body = postAs(TABLES, sessionFor("creator"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String code = json.readTree(body).path("code").asString();
        for (String account : new String[] {"second", "third", "fourth"}) {
            postAs(TABLES + "/" + code + "/join", sessionFor(account)).andExpect(status().isOk());
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

    private MockHttpSession sessionFor(String accountId) {
        accountId = accountPrefix + ":" + accountId;
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountId, accountId + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
