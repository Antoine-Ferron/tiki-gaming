package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
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
class GameShotHttpTest {
    private static final String TABLES = "/api/games/bang/tables";
    private final String accounts = UUID.randomUUID().toString();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private PrivateTableService tables;

    @MockitoSpyBean
    private InitialDeal deal;

    @Test
    void firingConsumesOneCardAndPublishesOnePendingShot() throws Exception {
        String code = startedTable();
        GameState before = tables.game(code);

        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());

        view(code, 1)
                .andExpect(jsonPath("$.pendingShot.id").isNotEmpty())
                .andExpect(jsonPath("$.pendingShot.shooterSeat").value(1))
                .andExpect(jsonPath("$.pendingShot.targetSeat").value(2))
                .andExpect(jsonPath("$.currentSeat").value(1))
                .andExpect(jsonPath("$.phase").value("PLAY"));
        GameState after = tables.game(code);
        assertThat(after.players().getFirst().hand()).containsExactly(card("bang-2", CardType.BANG));
        assertThat(after.discardPile()).containsExactly(card("old", CardType.MISSED), card("bang-1", CardType.BANG));
        assertThat(after.drawPile()).isEqualTo(before.drawPile());
        assertThat(after.players().subList(1, 4)).isEqualTo(before.players().subList(1, 4));
    }

    private String startedTable() throws Exception {
        doReturn(new GameState(
                        List.of(
                                player(
                                        1,
                                        BangCharacter.BART_CASSIDY,
                                        card("bang-1", CardType.BANG),
                                        card("bang-2", CardType.BANG)),
                                player(2, BangCharacter.CALAMITY_JANET, card("missed-2", CardType.MISSED)),
                                player(3, BangCharacter.PAUL_REGRET),
                                player(4, BangCharacter.WILLY_THE_KID)),
                        List.of(card("draw-1", CardType.BANG), card("draw-2", CardType.MISSED)),
                        List.of(card("old", CardType.MISSED)),
                        1,
                        GameState.Phase.PLAY))
                .when(deal)
                .deal(anyList());
        String body = mvc.perform(preparePost(TABLES, 1))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String code = json.readTree(body).path("code").asString();
        for (int seat = 2; seat <= 4; seat++) command(code, "join", seat).andExpect(status().isOk());
        command(code, "start", 1).andExpect(status().isOk());
        return code;
    }

    private GameState.Player player(int seat, BangCharacter character, CardInstance... hand) {
        Role role = seat == 1 ? Role.SHERIFF : seat == 4 ? Role.RENEGADE : Role.OUTLAW;
        return new GameState.Player(
                accounts + ":" + seat,
                seat,
                new RoleCard(role, seat == 1),
                character,
                character.lifePoints(),
                character.lifePoints(),
                List.of(hand));
    }

    private static CardInstance card(String id, CardType type) {
        return new CardInstance(id, type);
    }

    private ResultActions view(String code, int seat) throws Exception {
        return mvc.perform(get(TABLES + "/{code}/state", code).session(sessionFor(seat)));
    }

    private ResultActions command(String code, String action, int seat) throws Exception {
        return mvc.perform(preparePost(TABLES + "/" + code + "/" + action, seat));
    }

    private MockHttpServletRequestBuilder preparePost(String path, int seat) throws Exception {
        MockHttpSession session = sessionFor(seat);
        Cookie csrf = mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        return post(path).session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
    }

    private MockHttpSession sessionFor(int seat) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accounts + ":" + seat, "player-" + seat + "@example.com"));
        return (MockHttpSession) request.getSession();
    }
}
