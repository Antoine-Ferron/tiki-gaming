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
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
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

    @Test
    void waitingForTheTargetLocksTheShootersOtherActionsWithoutMutation() throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        GameState waiting = tables.game(code);
        String pending = json.readTree(view(code, 1).andReturn().getResponse().getContentAsString())
                .path("pendingShot")
                .path("id")
                .asString();

        command(code, "shots/bang-2/targets/4", 1).andExpect(status().isConflict());
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isConflict());
        command(code, "turn/end", 1).andExpect(status().isConflict());
        command(code, "turn/draw", 1).andExpect(status().isConflict());
        command(code, "turn/discard/bang-2", 1).andExpect(status().isConflict());

        assertThat(tables.game(code)).isSameAs(waiting);
        view(code, 2).andExpect(jsonPath("$.pendingShot.id").value(pending));
    }

    @Test
    void theTargetDodgesAndTheShooterResumesTheSameTurn() throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);

        command(code, "shots/" + shot + "/dodge/missed-2", 2).andExpect(status().isNoContent());

        view(code, 2)
                .andExpect(jsonPath("$.pendingShot").doesNotExist())
                .andExpect(jsonPath("$.hand").isEmpty())
                .andExpect(jsonPath("$.players[1].health").value(4))
                .andExpect(jsonPath("$.currentSeat").value(1))
                .andExpect(jsonPath("$.phase").value("PLAY"));
        assertThat(tables.game(code).discardPile())
                .containsExactly(
                        card("old", CardType.MISSED), card("bang-1", CardType.BANG), card("missed-2", CardType.MISSED));
        command(code, "turn/end", 1).andExpect(status().isNoContent());
        view(code, 1)
                .andExpect(jsonPath("$.currentSeat").value(2))
                .andExpect(jsonPath("$.phase").value("DRAW"));
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 3, 5})
    void onlyTheTargetSessionCanDodgeEvenWhenTheRequestClaimsItsIdentity(int actor) throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);
        GameState before = tables.game(code);

        mvc.perform(preparePost(TABLES + "/" + code + "/shots/" + shot + "/dodge/missed-2", actor)
                        .param("accountId", accounts + ":2")
                        .param("seat", "2"))
                .andExpect(status().isForbidden());

        assertThat(tables.game(code)).isSameAs(before);
        view(code, 2).andExpect(jsonPath("$.pendingShot.id").value(shot));
    }

    @Test
    void aWrongShotOrUnavailableDodgeCardDoesNotResolveThePendingShot() throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);
        GameState before = tables.game(code);

        command(code, "shots/older-shot/dodge/missed-2", 2).andExpect(status().isConflict());
        command(code, "shots/" + shot + "/dodge/bang-2", 2).andExpect(status().isConflict());

        assertThat(tables.game(code)).isSameAs(before);
        view(code, 2).andExpect(jsonPath("$.pendingShot.id").value(shot));
    }

    @Test
    void acceptingTheShotLosesOneLifeOnlyAndRepeatedResponsesHaveNoEffect() throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);

        command(code, "shots/" + shot + "/accept", 2).andExpect(status().isNoContent());

        GameState resolved = tables.game(code);
        assertThat(resolved.players().get(1).health()).isEqualTo(3);
        assertThat(resolved.players().get(1).hand()).containsExactly(card("missed-2", CardType.MISSED));
        assertThat(resolved.discardPile()).containsExactly(card("old", CardType.MISSED), card("bang-1", CardType.BANG));
        view(code, 2).andExpect(jsonPath("$.pendingShot").doesNotExist());
        command(code, "shots/" + shot + "/accept", 2).andExpect(status().isConflict());
        command(code, "shots/" + shot + "/dodge/missed-2", 2).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(resolved);
        command(code, "turn/end", 1).andExpect(status().isNoContent());
    }

    @Test
    void reconnectingAndStartingAgainNeverResetTheTurnsShotLimit() throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);
        String targetView = view(code, 2).andReturn().getResponse().getContentAsString();

        command(code, "join", 2).andExpect(status().isOk());
        command(code, "start", 1).andExpect(status().isOk());
        assertThat(view(code, 2).andReturn().getResponse().getContentAsString()).isEqualTo(targetView);
        command(code, "shots/" + shot + "/accept", 2).andExpect(status().isNoContent());
        GameState resolved = tables.game(code);
        command(code, "join", 1).andExpect(status().isOk());
        command(code, "start", 2).andExpect(status().isOk());
        view(code, 1).andExpect(status().isOk());

        command(code, "shots/bang-2/targets/2", 1).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(resolved);
    }

    @Test
    void onlyStartingANewTurnResetsTheShotCounter() throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        command(code, "shots/" + pendingId(code) + "/accept", 2).andExpect(status().isNoContent());
        command(code, "turn/end", 1).andExpect(status().isNoContent());
        for (int seat = 2; seat <= 4; seat++) {
            command(code, "turn/draw", seat).andExpect(status().isNoContent());
            command(code, "turn/end", seat).andExpect(status().isNoContent());
        }
        command(code, "turn/draw", 1).andExpect(status().isNoContent());

        command(code, "shots/bang-2/targets/2", 1).andExpect(status().isNoContent());

        view(code, 1).andExpect(jsonPath("$.pendingShot.targetSeat").value(2));
    }

    @ParameterizedTest
    @EnumSource(
            value = GameState.Phase.class,
            names = {"DRAW", "DISCARD"})
    void shootingOutsideThePlayPhaseChangesNothing(GameState.Phase phase) throws Exception {
        String code = startedTable(preparedGame(BangCharacter.BART_CASSIDY, BangCharacter.CALAMITY_JANET, phase));
        GameState before = tables.game(code);

        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isConflict());

        assertThat(tables.game(code)).isSameAs(before);
        view(code, 1).andExpect(jsonPath("$.pendingShot").doesNotExist());
    }

    @ParameterizedTest
    @CsvSource({
        "bang-1,1,1,409",
        "bang-1,3,1,409",
        "bang-1,9,1,409",
        "unknown,2,1,409",
        "missed-2,2,1,409",
        "bang-1,2,2,403",
        "bang-1,2,5,403"
    })
    void invalidFiringChangesNeitherTheGameNorTheShotAllowance(String cardId, int target, int actor, int expected)
            throws Exception {
        String code = startedTable();
        GameState before = tables.game(code);

        command(code, "shots/" + cardId + "/targets/" + target, actor).andExpect(status().is(expected));

        assertThat(tables.game(code)).isSameAs(before);
        view(code, 1).andExpect(jsonPath("$.pendingShot").doesNotExist());
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
    }

    @Test
    void paulRegretsDistancePowerIsAppliedByTheRealShotRules() throws Exception {
        String code =
                startedTable(preparedGame(BangCharacter.BART_CASSIDY, BangCharacter.PAUL_REGRET, GameState.Phase.PLAY));
        GameState before = tables.game(code);

        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isConflict());

        assertThat(tables.game(code)).isSameAs(before);
        view(code, 1).andExpect(jsonPath("$.pendingShot").doesNotExist());
    }

    private String pendingId(String code) throws Exception {
        return json.readTree(view(code, 2)
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString())
                .path("pendingShot")
                .path("id")
                .asString();
    }

    private String startedTable() throws Exception {
        return startedTable(
                preparedGame(BangCharacter.BART_CASSIDY, BangCharacter.CALAMITY_JANET, GameState.Phase.PLAY));
    }

    private GameState preparedGame(BangCharacter shooter, BangCharacter target, GameState.Phase phase) {
        return new GameState(
                List.of(
                        player(1, shooter, card("bang-1", CardType.BANG), card("bang-2", CardType.BANG)),
                        player(2, target, card("missed-2", CardType.MISSED)),
                        player(3, BangCharacter.PAUL_REGRET),
                        player(4, BangCharacter.WILLY_THE_KID)),
                IntStream.rangeClosed(1, 10)
                        .mapToObj(i -> card("draw-" + i, CardType.BANG))
                        .toList(),
                List.of(card("old", CardType.MISSED)),
                1,
                phase);
    }

    private String startedTable(GameState game) throws Exception {
        doReturn(game).when(deal).deal(anyList());
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
