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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.servlet.MockMvc;
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
@Import(GameStartWiringHttpTest.Catalogue.class)
class GameStartWiringHttpTest {
    private final String accountPrefix = UUID.randomUUID().toString();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private PrivateTableService tables;

    @Autowired
    private ObjectMapper json;

    @TestConfiguration
    static class Catalogue {
        @Bean
        GameCatalog catalog() {
            return new TestGameCatalog();
        }
    }

    @Test
    void acceptanceUsesTheRealComponentsAndShuffleWithOnlyTheUnavailableCatalogueReplaced() throws Exception {
        MockHttpSession session = sessionFor("player-4");
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
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

        var response = mvc.perform(post("/api/games/bang/tables/" + code + "/start")
                        .session(session)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());

        GameState game = tables.game(code);
        assertThat(game.players())
                .extracting(GameState.Player::role)
                .containsExactlyInAnyOrder("Shérif", "Hors-la-loi", "Hors-la-loi", "Renégat");
        assertThat(game.players())
                .extracting(player -> player.character().id())
                .doesNotHaveDuplicates()
                .hasSize(4);
        assertThat(game.players().get(game.currentSeat() - 1).role()).isEqualTo("Shérif");
        List<String> allCards = new ArrayList<>(game.drawPile());
        for (GameState.Player player : game.players()) {
            int expectedHealth = player.character().health() + (player.role().equals("Shérif") ? 1 : 0);
            assertThat(player.health()).isEqualTo(expectedHealth);
            assertThat(player.maxHealth()).isEqualTo(expectedHealth);
            assertThat(player.hand()).hasSize(expectedHealth);
            allCards.addAll(player.hand());
        }
        assertThat(game.drawPile()).hasSize(24);
        assertThat(allCards).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(new TestGameCatalog().cards());
        response.andExpect(content()
                .json(
                        "{\"code\":\"" + code + "\",\"currentSeat\":" + game.currentSeat() + "}",
                        JsonCompareMode.STRICT));
    }

    private MockHttpSession sessionFor(String accountId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountPrefix + ":" + accountId, "joueur@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
