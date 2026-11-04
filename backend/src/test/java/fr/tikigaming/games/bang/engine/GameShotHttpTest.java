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
import java.time.Duration;
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
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
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
@Import(GameShotHttpTest.Setup.class)
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
    }

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

    @Test
    void willyCanShootAgainButAnOldResponseCannotResolveHisNewShot() throws Exception {
        String code = startedTable(
                preparedGame(BangCharacter.WILLY_THE_KID, BangCharacter.CALAMITY_JANET, GameState.Phase.PLAY));
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String oldShot = pendingId(code);
        command(code, "shots/" + oldShot + "/accept", 2).andExpect(status().isNoContent());
        command(code, "join", 1).andExpect(status().isOk());
        command(code, "start", 2).andExpect(status().isOk());
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isConflict());
        command(code, "shots/bang-2/targets/2", 1).andExpect(status().isNoContent());
        String newShot = pendingId(code);
        assertThat(newShot).isNotBlank().isNotEqualTo(oldShot);
        GameState beforeLateResponses = tables.game(code);

        command(code, "shots/" + oldShot + "/accept", 2).andExpect(status().isConflict());
        command(code, "shots/" + oldShot + "/dodge/missed-2", 2).andExpect(status().isConflict());

        assertThat(tables.game(code)).isSameAs(beforeLateResponses);
        view(code, 2).andExpect(jsonPath("$.pendingShot.id").value(newShot));
        command(code, "shots/" + newShot + "/dodge/missed-2", 2).andExpect(status().isNoContent());
        assertThat(tables.game(code).players().get(1).health()).isEqualTo(3);
        assertThat(tables.game(code).discardPile())
                .containsExactly(
                        card("old", CardType.MISSED),
                        card("bang-1", CardType.BANG),
                        card("bang-2", CardType.BANG),
                        card("missed-2", CardType.MISSED));
    }

    @Test
    void calamityUsesAMissedToShootAndABangToDodgeWithoutBypassingTheTurnLimit() throws Exception {
        GameState initial =
                preparedGame(BangCharacter.CALAMITY_JANET, BangCharacter.CALAMITY_JANET, GameState.Phase.PLAY);
        List<GameState.Player> players = new ArrayList<>(initial.players());
        players.set(
                0,
                player(
                        1,
                        BangCharacter.CALAMITY_JANET,
                        card("substitute", CardType.MISSED),
                        card("bang-2", CardType.BANG)));
        players.set(1, player(2, BangCharacter.CALAMITY_JANET, card("counter", CardType.BANG)));
        String code = startedTable(
                new GameState(List.copyOf(players), initial.drawPile(), initial.discardPile(), 1, initial.phase()));

        command(code, "shots/substitute/targets/2", 1).andExpect(status().isNoContent());
        command(code, "shots/" + pendingId(code) + "/dodge/counter", 2).andExpect(status().isNoContent());

        assertThat(tables.game(code).players().get(1).health()).isEqualTo(4);
        assertThat(tables.game(code).discardPile())
                .containsExactly(
                        card("old", CardType.MISSED),
                        card("substitute", CardType.MISSED),
                        card("counter", CardType.BANG));
        command(code, "shots/bang-2/targets/2", 1).andExpect(status().isConflict());
    }

    @Test
    void theNextActionRebuildsTheDistanceFromTheStateAfterAnElimination() throws Exception {
        GameState initial =
                preparedGame(BangCharacter.WILLY_THE_KID, BangCharacter.CALAMITY_JANET, GameState.Phase.PLAY);
        List<GameState.Player> players = new ArrayList<>(initial.players());
        GameState.Player target = players.get(1);
        players.set(
                1,
                new GameState.Player(
                        target.accountId(), 2, target.roleCard(), target.character(), 1, 4, target.hand()));
        players.set(2, player(3, BangCharacter.CALAMITY_JANET));
        String code = startedTable(
                new GameState(List.copyOf(players), initial.drawPile(), initial.discardPile(), 1, initial.phase()));
        GameState before = tables.game(code);
        command(code, "shots/bang-2/targets/3", 1).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(before);

        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        command(code, "shots/" + pendingId(code) + "/accept", 2).andExpect(status().isNoContent());

        assertThat(tables.game(code).players().get(1).health()).isZero();
        GameState afterElimination = tables.game(code);
        command(code, "shots/bang-2/targets/2", 1).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(afterElimination);
        command(code, "shots/bang-2/targets/3", 1).andExpect(status().isNoContent());
        view(code, 3).andExpect(jsonPath("$.pendingShot.targetSeat").value(3));
    }

    @Test
    void twoSimultaneousShotsByWillyCreateExactlyOnePendingShot() throws Exception {
        String code = startedTable(
                preparedGame(BangCharacter.WILLY_THE_KID, BangCharacter.CALAMITY_JANET, GameState.Phase.PLAY));

        List<MvcResult> results = simultaneously(
                preparePost(TABLES + "/" + code + "/shots/bang-1/targets/2", 1),
                preparePost(TABLES + "/" + code + "/shots/bang-2/targets/4", 1));

        assertThat(results)
                .extracting(result -> result.getResponse().getStatus())
                .containsExactlyInAnyOrder(204, 409);
        GameState after = tables.game(code);
        assertThat(after.players().getFirst().hand()).hasSize(1);
        assertThat(after.discardPile()).hasSize(2).contains(card("old", CardType.MISSED));
        String acceptedCard = results.getFirst().getResponse().getStatus() == 204 ? "bang-1" : "bang-2";
        assertThat(after.discardPile().getLast().id()).isEqualTo(acceptedCard);
        view(code, 1).andExpect(jsonPath("$.pendingShot.targetSeat").value(acceptedCard.equals("bang-1") ? 2 : 4));
    }

    @ParameterizedTest
    @CsvSource({"accept,accept", "dodge/missed-2,dodge/missed-2", "accept,dodge/missed-2"})
    void simultaneousResponsesResolveExactlyOnce(String first, String second) throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);
        String path = TABLES + "/" + code + "/shots/" + shot + "/";

        List<MvcResult> results = simultaneously(preparePost(path + first, 2), preparePost(path + second, 2));

        assertThat(results)
                .extracting(result -> result.getResponse().getStatus())
                .containsExactlyInAnyOrder(204, 409);
        String accepted = results.getFirst().getResponse().getStatus() == 204 ? first : second;
        boolean dodged = accepted.startsWith("dodge");
        GameState resolved = tables.game(code);
        assertThat(resolved.players().get(1).health()).isEqualTo(dodged ? 4 : 3);
        assertThat(resolved.players().get(1).hand()).hasSize(dodged ? 0 : 1);
        assertThat(resolved.discardPile()).hasSize(dodged ? 3 : 2);
        view(code, 1).andExpect(jsonPath("$.pendingShot").doesNotExist());
        command(code, "shots/" + shot + "/" + first, 2).andExpect(status().isConflict());
        assertThat(tables.game(code)).isSameAs(resolved);
        command(code, "turn/end", 1).andExpect(status().isNoContent());
    }

    @Test
    void fourAccountsSeeTheSamePendingShotAndResolutionWithOnlyTheirOwnSecrets() throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);

        assertPrivateViews(code, shot);
        command(code, "shots/" + shot + "/accept", 2).andExpect(status().isNoContent());
        assertPrivateViews(code, null);
    }

    private void assertPrivateViews(String code, String shot) throws Exception {
        GameState state = tables.game(code);
        for (int seat = 1; seat <= 4; seat++) {
            var view = json.readTree(view(code, seat)
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString());
            assertThat(view.size()).isEqualTo(shot == null ? 7 : 8);
            assertThat(view.path("seat").asInt()).isEqualTo(seat);
            assertThat(view.path("currentSeat").asInt()).isEqualTo(1);
            assertThat(view.path("phase").asString()).isEqualTo("PLAY");
            assertThat(view.path("role").asString())
                    .isEqualTo(state.players().get(seat - 1).roleCard().role().name());
            assertThat(view.path("hand"))
                    .isEqualTo(json.valueToTree(state.players().get(seat - 1).hand()));
            if (shot != null) {
                assertThat(view.path("pendingShot").size()).isEqualTo(3);
                assertThat(view.path("pendingShot").path("id").asString()).isEqualTo(shot);
                assertThat(view.path("pendingShot").path("shooterSeat").asInt()).isEqualTo(1);
                assertThat(view.path("pendingShot").path("targetSeat").asInt()).isEqualTo(2);
            }
            for (int index = 0; index < 4; index++) {
                var publicPlayer = view.path("players").get(index);
                var player = state.players().get(index);
                assertThat(publicPlayer.size()).isEqualTo(index == 0 ? 7 : 6);
                assertThat(publicPlayer.path("health").asInt()).isEqualTo(player.health());
                assertThat(publicPlayer.path("handCount").asInt())
                        .isEqualTo(player.hand().size());
                assertThat(publicPlayer.has("hand")).isFalse();
                assertThat(publicPlayer.has("accountId")).isFalse();
                assertThat(publicPlayer.has("roleCard")).isFalse();
                assertThat(publicPlayer.has("role")).isEqualTo(index == 0);
            }
        }
        assertThat(tables.game(code)).isSameAs(state);
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

    @ParameterizedTest
    @ValueSource(strings = {"fire", "accept", "dodge"})
    void acceptedShotActionsRenewActivity(String action) throws Exception {
        String code = startedTable();
        String shot = null;
        if (!action.equals("fire")) {
            command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
            shot = pendingId(code);
        }
        clock.advance(Duration.ofMinutes(59));
        String command = switch (action) {
            case "fire" -> "shots/bang-1/targets/2";
            case "accept" -> "shots/" + shot + "/accept";
            default -> "shots/" + shot + "/dodge/missed-2";
        };

        command(code, command, action.equals("fire") ? 1 : 2).andExpect(status().isNoContent());

        clock.advance(Duration.ofMinutes(59));
        view(code, 2).andExpect(status().isOk());
        clock.advance(Duration.ofMinutes(1));
        view(code, 2).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "read",
                "second-shot",
                "end",
                "wrong-actor",
                "wrong-id",
                "wrong-card",
                "repeat-fire",
                "repeat-accept",
                "repeat-dodge"
            })
    void readsRefusalsAndDuplicatesNeverRenewActivity(String action) throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);
        if (action.equals("repeat-accept")) {
            command(code, "shots/" + shot + "/accept", 2).andExpect(status().isNoContent());
        }
        if (action.equals("repeat-dodge")) {
            command(code, "shots/" + shot + "/dodge/missed-2", 2).andExpect(status().isNoContent());
        }
        GameState before = tables.game(code);
        clock.advance(Duration.ofMinutes(59));

        switch (action) {
            case "read" -> view(code, 2).andExpect(status().isOk());
            case "second-shot" -> command(code, "shots/bang-2/targets/2", 1).andExpect(status().isConflict());
            case "repeat-fire" -> command(code, "shots/bang-1/targets/2", 1).andExpect(status().isConflict());
            case "end" -> command(code, "turn/end", 1).andExpect(status().isConflict());
            case "wrong-actor" -> command(code, "shots/" + shot + "/accept", 3).andExpect(status().isForbidden());
            case "wrong-id" -> command(code, "shots/old/accept", 2).andExpect(status().isConflict());
            case "wrong-card" ->
                command(code, "shots/" + shot + "/dodge/bang-2", 2).andExpect(status().isConflict());
            case "repeat-accept" ->
                command(code, "shots/" + shot + "/accept", 2).andExpect(status().isConflict());
            default -> command(code, "shots/" + shot + "/dodge/missed-2", 2).andExpect(status().isConflict());
        }

        assertThat(tables.game(code)).isSameAs(before);
        clock.advance(Duration.ofMinutes(1));
        view(code, 2).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(strings = {"shots/bang-1/targets/2", "shots/{shot}/accept", "shots/{shot}/dodge/missed-2"})
    void shotEndpointsRequireAuthenticationAndValidCsrf(String action) throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String path = TABLES + "/" + code + "/" + action.replace("{shot}", pendingId(code));
        GameState before = tables.game(code);

        mvc.perform(preparePost(path, new MockHttpSession())).andExpect(status().isUnauthorized());
        mvc.perform(post(path).session(sessionFor(2))).andExpect(status().isForbidden());
        mvc.perform(post(path)
                        .session(sessionFor(2))
                        .cookie(new Cookie("XSRF-TOKEN", "correct"))
                        .header("X-XSRF-TOKEN", "incorrect"))
                .andExpect(status().isForbidden());

        assertThat(tables.game(code)).isSameAs(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"shots/bang-1/targets/2", "shots/old/accept", "shots/old/dodge/missed-2"})
    void unknownAndUnstartedTablesRejectShotActions(String action) throws Exception {
        command("UNKNOWN", action, 1).andExpect(status().isNotFound());
        String code = fullTable();

        command(code, action, 1).andExpect(status().isConflict());
        command(code, action, 5).andExpect(status().isForbidden());

        assertThat(tables.game(code)).isNull();
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 3, 5})
    void onlyTheTargetSessionCanAcceptTheShot(int actor) throws Exception {
        String code = startedTable();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);
        GameState before = tables.game(code);

        mvc.perform(preparePost(TABLES + "/" + code + "/shots/" + shot + "/accept", actor)
                        .param("accountId", accounts + ":2")
                        .param("seat", "2"))
                .andExpect(status().isForbidden());

        assertThat(tables.game(code)).isSameAs(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-a-seat", "2147483648", "-2147483649"})
    void aMalformedTargetSeatIsABadRequestWithoutMutation(String target) throws Exception {
        String code = startedTable();
        GameState before = tables.game(code);

        command(code, "shots/bang-1/targets/" + target, 1)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Siège cible invalide."));

        assertThat(tables.game(code)).isSameAs(before);
        view(code, 1).andExpect(jsonPath("$.pendingShot").doesNotExist());
    }

    @Test
    void shotsAndResponsesAcceptTheNormalizedTableCode() throws Exception {
        String code = startedTable();
        String entered = "  " + code.toLowerCase(Locale.ROOT) + "  ";

        command(entered, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        command(entered, "shots/" + pendingId(code) + "/dodge/missed-2", 2).andExpect(status().isNoContent());

        view(code, 1).andExpect(jsonPath("$.pendingShot").doesNotExist());
    }

    @Test
    void bartReceivesTheFirstDrawCardWhenAcceptingANonLethalShot() throws Exception {
        String code = startedTable(
                preparedGame(BangCharacter.CALAMITY_JANET, BangCharacter.BART_CASSIDY, GameState.Phase.PLAY));
        GameState before = tables.game(code);
        CardInstance bonus = before.drawPile().getFirst();
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);

        command(code, "shots/" + shot + "/accept", 2).andExpect(status().isNoContent());

        view(code, 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[1].health").value(3))
                .andExpect(jsonPath("$.hand[1].id").value(bonus.id()))
                .andExpect(jsonPath("$.hand[1].type").value(bonus.type().name()))
                .andExpect(jsonPath("$.currentSeat").value(1))
                .andExpect(jsonPath("$.phase").value("PLAY"))
                .andExpect(jsonPath("$.pendingShot").doesNotExist());
        GameState after = tables.game(code);
        assertThat(after.players().get(1).hand()).containsExactly(card("missed-2", CardType.MISSED), bonus);
        assertThat(after.drawPile())
                .containsExactlyElementsOf(
                        before.drawPile().subList(1, before.drawPile().size()));
        assertThat(after.discardPile()).containsExactly(card("old", CardType.MISSED), card("bang-1", CardType.BANG));
        assertThat(before.players().get(1).hand()).containsExactly(card("missed-2", CardType.MISSED));
        assertThat(before.drawPile()).hasSize(10);
    }

    @ParameterizedTest
    @ValueSource(strings = {"dodge", "lethal"})
    void bartDoesNotReceiveABonusAfterADodgeOrLethalDamage(String action) throws Exception {
        GameState initial =
                preparedGame(BangCharacter.CALAMITY_JANET, BangCharacter.BART_CASSIDY, GameState.Phase.PLAY);
        if (action.equals("lethal")) {
            List<GameState.Player> players = new ArrayList<>(initial.players());
            GameState.Player bart = players.get(1);
            players.set(
                    1,
                    new GameState.Player(
                            bart.accountId(),
                            bart.seat(),
                            bart.roleCard(),
                            bart.character(),
                            1,
                            bart.maxHealth(),
                            bart.hand()));
            initial = new GameState(
                    List.copyOf(players),
                    initial.drawPile(),
                    initial.discardPile(),
                    initial.currentSeat(),
                    initial.phase());
        }
        String code = startedTable(initial);
        command(code, "shots/bang-1/targets/2", 1).andExpect(status().isNoContent());
        String shot = pendingId(code);

        command(code, "shots/" + shot + (action.equals("dodge") ? "/dodge/missed-2" : "/accept"), 2)
                .andExpect(status().isNoContent());

        GameState after = tables.game(code);
        assertThat(after.players().get(1).health()).isEqualTo(action.equals("dodge") ? 4 : 0);
        assertThat(after.players().get(1).hand()).hasSize(action.equals("dodge") ? 0 : 1);
        assertThat(after.drawPile()).isEqualTo(initial.drawPile());
        view(code, 2).andExpect(jsonPath("$.pendingShot").doesNotExist());
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
        String code = fullTable();
        command(code, "start", 1).andExpect(status().isOk());
        return code;
    }

    private String fullTable() throws Exception {
        String body = mvc.perform(preparePost(TABLES, 1))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String code = json.readTree(body).path("code").asString();
        for (int seat = 2; seat <= 4; seat++) command(code, "join", seat).andExpect(status().isOk());
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
        return preparePost(path, sessionFor(seat));
    }

    private MockHttpServletRequestBuilder preparePost(String path, MockHttpSession session) throws Exception {
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
