package fr.tikigaming.games.sdv_civilisation.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.sdv_civilisation.Clock;
import fr.tikigaming.games.sdv_civilisation.FakeClock;
import fr.tikigaming.games.sdv_civilisation.FixedShuffler;
import fr.tikigaming.games.sdv_civilisation.Shuffler;
import fr.tikigaming.games.sdv_civilisation.TurnTimer;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Intégration de bout en bout côté serveur : application Spring complète (sécurité, CSRF, session, validation, JSON,
 * gestion des erreurs), appelée comme le front l'appelle. Seules les frontières externes sont remplacées : horloge
 * (fake), mélange (stub), parties des comptes (fake en mémoire à la place de Supabase) et scores (spy).
 */
@SpringBootTest(
        properties = {
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@AutoConfigureMockMvc
@Import(SdvCivilisationApiIntegrationTest.Doubles.class)
class SdvCivilisationApiIntegrationTest {

    private static final String API = "/api/games/sdv-civilisation";
    private static final String CITADEL = "{\"wonder\": \"Citadelle d’Orkan\"}";

    @TestConfiguration
    static class Doubles {

        @Bean
        @Primary
        FakeClock fakeClock() {
            return new FakeClock(1_000);
        }

        @Bean
        @Primary
        Shuffler fixedShuffler() {
            return FixedShuffler.KEEP;
        }

        @Bean
        @Primary
        InMemoryUserGames inMemoryUserGames() {
            return new InMemoryUserGames();
        }

        @Bean
        @Primary
        RecordingScoreRecorder recordingScores() {
            return new RecordingScoreRecorder();
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    FakeClock clock;

    @Autowired
    InMemoryUserGames accounts;

    @Autowired
    RecordingScoreRecorder scores;

    @Autowired
    Clock usedClock;

    @BeforeEach
    void freshAccountsAndScores() {
        // Chaque test a ses propres sessions et comptes : aucun ne dépend d'un autre (pas de test flaky).
        accounts.reset();
        scores.recorded.clear();
    }

    /** Requête POST telle que l'envoie le front : JSON, et jeton CSRF recopié du cookie dans l'en-tête. */
    private static MockHttpServletRequestBuilder send(String path, MockHttpSession session, String body) {
        return post(API + path)
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .cookie(new Cookie("XSRF-TOKEN", "jeton"))
                .header("X-XSRF-TOKEN", "jeton");
    }

    private static String turn(int card, String action, int version) {
        return "{\"card\": %d, \"action\": \"%s\", \"version\": %d}".formatted(card, action, version);
    }

    private static MockHttpSession signedIn(String userId) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("tiki.user", new AuthUser(userId, userId + "@example.com"));
        return session;
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    @Test
    void theRealClockIsReplacedByTheFake() {
        // Garde-fou : sans cette substitution, les tests du minuteur dépendraient de l'heure réelle.
        assertThat(usedClock).isSameAs(clock);
    }

    @Test
    void aGuestChoosesAWonderStartsAGameAndFindsItAgainInItsSession() throws Exception {
        MockHttpSession guest = new MockHttpSession();

        // Étant donné les merveilles proposées au choix
        mvc.perform(get(API + "/wonders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[3].name").value("Citadelle d’Orkan"))
                .andExpect(jsonPath("$[3].resource").value("stone"));

        // Quand l'invité commence une partie avec la Citadelle d’Orkan
        // Alors il reçoit sa main avec le prix de chaque carte, la table, et 60 s pour jouer
        mvc.perform(send("/games", guest, CITADEL))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.remainingMs").value(TurnTimer.DURATION_MILLIS))
                .andExpect(jsonPath("$.hand", hasSize(7)))
                .andExpect(jsonPath("$.hand[0].card.name").value("Chantier"))
                .andExpect(jsonPath("$.hand[0].build.ok").value(true))
                .andExpect(jsonPath("$.players[0].name").value("Toi"))
                .andExpect(jsonPath("$.players[0].production[0]").value("stone"))
                .andExpect(jsonPath("$.players[1].isBot").value(true))
                .andExpect(jsonPath("$.passesLeft").value(true))
                // Et jamais les mains des IA
                .andExpect(jsonPath("$.hands").doesNotExist());

        // Et il retrouve sa partie dans sa session ; une autre session n'a pas de partie
        mvc.perform(get(API + "/games/current").session(guest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));
        mvc.perform(get(API + "/games/current").session(new MockHttpSession())).andExpect(status().isNoContent());
    }

    @Test
    void aTurnIsPlayedThenADuplicateOrIllegalMoveIsRefused() throws Exception {
        // Étant donné une partie commencée
        MockHttpSession guest = new MockHttpSession();
        mvc.perform(send("/games", guest, CITADEL)).andExpect(status().isCreated());

        // Quand le joueur construit sa première carte
        // Alors le tour 2 commence, avec ce que chacun a joué
        mvc.perform(send("/games/current/turns", guest, turn(0, "build", 1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.turn").value(2))
                .andExpect(jsonPath("$.lastTurn", hasSize(3)))
                .andExpect(jsonPath("$.lastTurn[0].action").value("build"))
                .andExpect(jsonPath("$.players[0].built[0].name").value("Chantier"));

        // Quand le même coup arrive une seconde fois (double clic, autre onglet)
        // Alors il est refusé (409), avec la partie à jour
        mvc.perform(send("/games/current/turns", guest, turn(0, "build", 1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value(SdvCivilisationService.STALE))
                .andExpect(jsonPath("$.game.version").value(2));

        // Et un coup interdit, ou illisible, est refusé (400) avec un message pour le joueur
        mvc.perform(send("/games/current/turns", guest, turn(0, "build", 2)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Tu as déjà construit cette carte."));
        mvc.perform(send("/games/current/turns", guest, turn(9, "discard", 2)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(SdvCivilisationService.NOT_IN_HAND));
        mvc.perform(send("/games/current/turns", guest, "{\"card\": 0, \"action\": \"voler\", \"version\": 2}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void whenTheTimerRunsOutTheServerDiscardsARandomCard() throws Exception {
        // Étant donné une partie dont le joueur laisse passer les 60 s du tour
        MockHttpSession guest = new MockHttpSession();
        mvc.perform(send("/games", guest, CITADEL)).andExpect(status().isCreated());
        clock.advance(TurnTimer.DURATION_MILLIS);

        // Quand il revient sur la partie
        // Alors le tour 2 a commencé : une carte de sa main a été défaussée à sa place
        mvc.perform(get(API + "/games/current").session(guest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.turn").value(2))
                .andExpect(jsonPath("$.lastTurn[0].action").value("discard"))
                .andExpect(jsonPath("$.remainingMs").value(TurnTimer.DURATION_MILLIS));
    }

    @Test
    void aConnectedPlayerQuitsResumesOnAnotherDeviceAndHisScoreIsRecorded() throws Exception {
        // Étant donné un joueur connecté qui commence une partie sur son ordinateur
        String user = "user-1";
        mvc.perform(send("/games", signedIn(user), CITADEL)).andExpect(status().isCreated());

        // Quand il la reprend sur son téléphone (autre session, même compte)
        MockHttpSession phone = signedIn(user);
        JsonNode view = body(mvc.perform(get(API + "/games/current").session(phone))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1)));

        // Et qu'il joue les 18 tours jusqu'au bout
        while (!view.get("over").asBoolean()) {
            int version = view.get("version").asInt();
            view = body(mvc.perform(send("/games/current/turns", phone, turn(0, "discard", version)))
                    .andExpect(status().isOk()));
        }

        // Alors la partie est terminée avec le classement, et son score a été enregistré une fois
        assertThat(view.get("ranking")).hasSize(3);
        assertThat(view.get("remainingMs").asLong()).isZero();
        assertThat(scores.recorded)
                .extracting(RecordingScoreRecorder.Recorded::userId)
                .containsExactly(user);
    }

    @Test
    void abandoningForgetsTheGame() throws Exception {
        // Étant donné une partie commencée
        MockHttpSession guest = new MockHttpSession();
        mvc.perform(send("/games", guest, CITADEL)).andExpect(status().isCreated());

        // Quand le joueur l'abandonne
        mvc.perform(send("/games/current/abandon", guest, "{}")).andExpect(status().isNoContent());

        // Alors il n'a plus de partie, ni de coup à jouer
        mvc.perform(get(API + "/games/current").session(guest)).andExpect(status().isNoContent());
        mvc.perform(send("/games/current/turns", guest, turn(0, "discard", 1)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value(new NoGameException().getMessage()));
    }

    @Test
    void aMoveWithoutTheCsrfTokenOrAnUnknownWonderIsRefused() throws Exception {
        // Quand une requête n'a pas le jeton CSRF (site tiers)
        // Alors elle est refusée avant d'atteindre le jeu
        mvc.perform(post(API + "/games").contentType(MediaType.APPLICATION_JSON).content(CITADEL))
                .andExpect(status().isForbidden());

        // Et une merveille inconnue ou absente est refusée avec un message
        mvc.perform(send("/games", new MockHttpSession(), "{\"wonder\": \"Tour de Babel\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Merveille inconnue : Tour de Babel"));
        mvc.perform(send("/games", new MockHttpSession(), "{}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("merveille")));
    }

    @Test
    void theApiIsDocumentedInSwagger() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/games/sdv-civilisation/games'].post.summary")
                        .isNotEmpty())
                .andExpect(jsonPath("$.paths.*.*.tags[*]", hasItem("SDV Civilisation")));
    }
}
