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
    @Autowired
    private MockMvc mvc;

    @Autowired
    private PrivateTableService tables;

    @TestConfiguration
    static class Catalogue {
        @Bean
        GameCatalog catalog() {
            return new TestGameCatalog();
        }
    }

    @Test
    void acceptanceUsesTheRealComponentsAndShuffleWithOnlyTheUnavailableCatalogueReplaced() throws Exception {
        String code = tables.create("player-1").code();
        for (int player = 2; player <= 4; player++) tables.join(code, "player-" + player);
        MockHttpServletRequest login = new MockHttpServletRequest();
        AuthSession.signIn(login, new AuthUser("player-4", "joueur@example.com"));
        MockHttpSession session = (MockHttpSession) login.getSession();
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");

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
}
