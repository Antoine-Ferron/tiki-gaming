package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.UUID;
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
@Import(GameTurnWiringHttpTest.Setup.class)
class GameTurnWiringHttpTest {
    private static final String TABLES = "/api/games/bang/tables";
    private final String accountPrefix = UUID.randomUUID().toString();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private PrivateTableService tables;

    @Autowired
    private BangGameCatalog catalog;

    @TestConfiguration
    static class Setup {
        @Bean
        @Primary
        InitialDeal repeatableDeal(GameCatalog catalog) {
            return new InitialDeal(catalog, list -> Collections.shuffle(list, new Random(57)));
        }
    }

    @Test
    void productionComponentsRunFromTableCreationThroughTheNextPlayersDraw() throws Exception {
        String body = postAs(TABLES, 1)
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String code = json.readTree(body).path("code").asString();
        for (int seat = 2; seat <= 4; seat++) {
            postAs(TABLES + "/" + code + "/join", seat).andExpect(status().isOk());
        }
        postAs(TABLES + "/" + code + "/start", 4).andExpect(status().isOk());
        GameState initial = tables.game(code);
        assertThat(initial.phase()).isEqualTo(GameState.Phase.DRAW);
        assertThat(initial.discardPile()).isEmpty();
        assertThat(initial.players())
                .allSatisfy(player -> assertThat(player.hand()).hasSize(player.health()));
        GameState.Player sheriff = initial.players().get(initial.currentSeat() - 1);
        assertThat(sheriff.roleCard().role()).isEqualTo(Role.SHERIFF);

        postAs(TABLES + "/" + code + "/turn/draw", sheriff.seat())
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
        List<CardInstance> expectedSheriffHand = new ArrayList<>(sheriff.hand());
        expectedSheriffHand.addAll(initial.drawPile().subList(0, 2));
        assertThat(tables.game(code).players().get(sheriff.seat() - 1).hand())
                .containsExactlyElementsOf(expectedSheriffHand);
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(sheriff.seat())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phase").value("PLAY"))
                .andExpect(jsonPath("$.hand.length()").value(sheriff.health() + 2));

        postAs(TABLES + "/" + code + "/turn/end", sheriff.seat()).andExpect(status().isNoContent());
        assertThat(tables.game(code).phase()).isEqualTo(GameState.Phase.DISCARD);
        List<CardInstance> discarded =
                List.of(sheriff.hand().get(1), initial.drawPile().get(1));
        for (CardInstance card : discarded) {
            postAs(TABLES + "/" + code + "/turn/discard/" + card.id(), sheriff.seat())
                    .andExpect(status().isNoContent());
        }
        expectedSheriffHand.removeAll(discarded);
        postAs(TABLES + "/" + code + "/turn/end", sheriff.seat()).andExpect(status().isNoContent());

        int nextSeat = sheriff.seat() % 4 + 1;
        GameState next = tables.game(code);
        assertThat(next.currentSeat()).isEqualTo(nextSeat);
        assertThat(next.phase()).isEqualTo(GameState.Phase.DRAW);
        assertThat(next.drawPile())
                .containsExactlyElementsOf(
                        initial.drawPile().subList(2, initial.drawPile().size()));
        assertThat(next.players().get(sheriff.seat() - 1).hand()).containsExactlyElementsOf(expectedSheriffHand);
        assertThat(next.players().get(nextSeat - 1).hand())
                .isEqualTo(initial.players().get(nextSeat - 1).hand());
        mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(nextSeat)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phase").value("DRAW"))
                .andExpect(jsonPath("$.seat").value(nextSeat))
                .andExpect(jsonPath("$.currentSeat").value(nextSeat))
                .andExpect(jsonPath("$.hand.length()")
                        .value(next.players().get(nextSeat - 1).health()));

        postAs(TABLES + "/" + code + "/turn/draw", nextSeat).andExpect(status().isNoContent());
        GameState finalState = tables.game(code);
        List<CardInstance> expectedNextHand =
                new ArrayList<>(initial.players().get(nextSeat - 1).hand());
        expectedNextHand.addAll(initial.drawPile().subList(2, 4));
        assertThat(finalState.players().get(nextSeat - 1).hand()).containsExactlyElementsOf(expectedNextHand);
        assertThat(finalState.discardPile()).containsExactlyElementsOf(discarded);
        assertThat(finalState.drawPile())
                .containsExactlyElementsOf(
                        initial.drawPile().subList(4, initial.drawPile().size()));
        List<CardInstance> allCards = new ArrayList<>(finalState.drawPile());
        allCards.addAll(finalState.discardPile());
        finalState.players().forEach(player -> allCards.addAll(player.hand()));
        assertThat(allCards).extracting(CardInstance::id).doesNotHaveDuplicates();
        assertThat(allCards).hasSize(37).containsExactlyInAnyOrderElementsOf(catalog.cards());
    }

    private ResultActions postAs(String path, int seat) throws Exception {
        MockHttpSession session = sessionFor(seat);
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        return mvc.perform(post(path).session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()));
    }

    private MockHttpSession sessionFor(int seat) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountPrefix + ":player-" + seat, "player-" + seat + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
