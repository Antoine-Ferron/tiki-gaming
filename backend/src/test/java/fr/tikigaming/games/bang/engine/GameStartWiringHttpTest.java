package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
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
class GameStartWiringHttpTest {
    private final String accountPrefix = UUID.randomUUID().toString();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private PrivateTableService tables;

    @Autowired
    private ObjectMapper json;

    @MockitoSpyBean
    private InitialDeal initialDeal;

    @Test
    void acceptanceStartsWithTheProductionCatalogueAndRealComponents() throws Exception {
        MockHttpSession session = sessionFor("player-4");
        Cookie csrf = csrfFor(session);
        String code = fullTable(csrf);

        var response = mvc.perform(post("/api/games/bang/tables/" + code + "/start")
                        .session(session)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());

        GameState game = tables.game(code);
        assertInitialDeal(game);
        response.andExpect(content()
                .json(
                        "{\"code\":\"" + code + "\",\"currentSeat\":" + game.currentSeat() + "}",
                        JsonCompareMode.STRICT));
        verify(initialDeal).deal(anyList());
    }

    @Test
    void simultaneousStartsWithTheProductionCatalogueKeepOneDealAndOneDeck() throws Exception {
        Cookie csrf = csrfFor(sessionFor("creator"));
        String code = fullTable(csrf);
        var firstRequest = startRequest(code, "player-2", csrf);
        var secondRequest = startRequest(code, "player-3", csrf);
        CyclicBarrier start = new CyclicBarrier(2);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> startTogether(firstRequest, start));
            var second = executor.submit(() -> startTogether(secondRequest, start));
            var responses = List.of(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS));
            GameState game = tables.game(code);
            for (MvcResult response : responses) {
                status().isOk().match(response);
                content()
                        .json(
                                "{\"code\":\"" + code + "\",\"currentSeat\":" + game.currentSeat() + "}",
                                JsonCompareMode.STRICT)
                        .match(response);
            }
            assertInitialDeal(game);
            mvc.perform(startRequest(code, "player-4", csrf)).andExpect(status().isOk());
            assertThat(tables.game(code)).isSameAs(game);
        }
        verify(initialDeal).deal(anyList());
    }

    private static void assertInitialDeal(GameState game) {
        assertThat(game.players())
                .extracting(player -> player.roleCard().role())
                .containsExactlyInAnyOrder(Role.SHERIFF, Role.OUTLAW, Role.OUTLAW, Role.RENEGADE);
        assertThat(game.players())
                .extracting(GameState.Player::character)
                .doesNotHaveDuplicates()
                .hasSize(4);
        assertThat(game.players().get(game.currentSeat() - 1).roleCard().role()).isEqualTo(Role.SHERIFF);
        List<CardInstance> allCards = new ArrayList<>(game.drawPile());
        for (GameState.Player player : game.players()) {
            int expectedHealth =
                    player.character().lifePoints() + (player.roleCard().role() == Role.SHERIFF ? 1 : 0);
            assertThat(player.health()).isEqualTo(expectedHealth);
            assertThat(player.maxHealth()).isEqualTo(expectedHealth);
            assertThat(player.hand()).hasSize(expectedHealth);
            allCards.addAll(player.hand());
        }
        assertThat(game.drawPile()).hasSize(21);
        assertThat(allCards).extracting(CardInstance::id).doesNotHaveDuplicates();
        assertThat(allCards).hasSize(37);
        assertThat(allCards).filteredOn(card -> card.type() == CardType.BANG).hasSize(25);
        assertThat(allCards).filteredOn(card -> card.type() == CardType.MISSED).hasSize(12);
    }

    private String fullTable(Cookie csrf) throws Exception {
        String body = mvc.perform(post("/api/games/bang/tables")
                        .session(sessionFor("creator"))
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String code = json.readTree(body).path("code").asString();
        for (int player = 2; player <= 4; player++) {
            mvc.perform(post("/api/games/bang/tables/" + code + "/join")
                            .session(sessionFor("player-" + player))
                            .cookie(csrf)
                            .header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isOk());
        }
        return code;
    }

    private Cookie csrfFor(MockHttpSession session) throws Exception {
        return mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
    }

    private MockHttpServletRequestBuilder startRequest(String code, String account, Cookie csrf) {
        return post("/api/games/bang/tables/" + code + "/start")
                .session(sessionFor(account))
                .cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue());
    }

    private MvcResult startTogether(MockHttpServletRequestBuilder request, CyclicBarrier start) throws Exception {
        start.await(5, TimeUnit.SECONDS);
        return mvc.perform(request).andReturn();
    }

    private MockHttpSession sessionFor(String accountId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountPrefix + ":" + accountId, "joueur@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
