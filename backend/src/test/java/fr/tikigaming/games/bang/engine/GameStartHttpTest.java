package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.model.GameState;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
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

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private PrivateTableService tables;

    @TestConfiguration
    static class Setup {
        @Bean
        GameCatalog catalog() {
            return new TestGameCatalog();
        }

        @Bean
        @Primary
        InitialDeal orderedDeal(GameCatalog catalog) {
            return new InitialDeal(Optional.of(catalog), list -> Collections.rotate(list, 2));
        }
    }

    @Test
    void aSeatedPlayerStartsAFullTableWithoutReceivingPrivateCards() throws Exception {
        String code = fullTable();

        postAs(TABLES + "/" + code + "/start", sessionFor("third"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"code\":\"" + code + "\",\"currentSeat\":1}", JsonCompareMode.STRICT));

        GameState game = tables.game(code);
        assertThat(game.players())
                .extracting(GameState.Player::role)
                .containsExactlyInAnyOrder("Shérif", "Hors-la-loi", "Hors-la-loi", "Renégat");
        assertThat(game.players())
                .extracting(player -> player.character().id())
                .doesNotHaveDuplicates()
                .hasSize(4);
    }

    @Test
    void startingGivesEachCharacterItsHealthAndAddsTheSheriffBonus() throws Exception {
        String code = fullTable();

        postAs(TABLES + "/" + code + "/start", sessionFor("second")).andExpect(status().isOk());

        for (GameState.Player player : tables.game(code).players()) {
            int expected = player.character().health() + (player.role().equals("Shérif") ? 1 : 0);
            assertThat(player.health()).isEqualTo(expected);
            assertThat(player.maxHealth()).isEqualTo(expected);
        }
        GameState.Player paul = tables.game(code).players().get(2);
        assertThat(paul.character().id()).isEqualTo("Paul Regret");
        assertThat(paul.role()).isEqualTo("Shérif");
        assertThat(paul.health()).isEqualTo(4);
        assertThat(paul.maxHealth()).isEqualTo(4);
    }

    @Test
    void startingDealsOneCommonDeckWithoutDuplicatingCardsOrDrawingForTheFirstTurn() throws Exception {
        String code = fullTable();

        postAs(TABLES + "/" + code + "/start", sessionFor("fourth")).andExpect(status().isOk());

        GameState game = tables.game(code);
        List<String> allCards = new ArrayList<>(game.drawPile());
        for (GameState.Player player : game.players()) {
            assertThat(player.hand()).hasSize(player.health());
            allCards.addAll(player.hand());
        }
        assertThat(game.players().get(2).hand()).hasSize(4);
        assertThat(game.drawPile()).hasSize(24);
        assertThat(allCards).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(new TestGameCatalog().cards());
    }

    private String fullTable() throws Exception {
        String body =
                postAs(TABLES, sessionFor("creator")).andReturn().getResponse().getContentAsString();
        String code = json.readTree(body).path("code").asString();
        for (String account : new String[] {"second", "third", "fourth"}) {
            postAs(TABLES + "/" + code + "/join", sessionFor(account)).andExpect(status().isOk());
        }
        return code;
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
