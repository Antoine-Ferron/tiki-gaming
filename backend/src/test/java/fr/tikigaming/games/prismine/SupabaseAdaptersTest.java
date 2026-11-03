package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.config.TikiProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * TI — adaptateurs Supabase (PostgREST) avec le vrai client HTTP de Spring et la sérialisation JSON : on vérifie les
 * requêtes envoyées à un serveur simulé ({@link MockRestServiceServer}), sans réseau.
 */
class SupabaseAdaptersTest {

    private static final String URL = "https://ref.supabase.co";
    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String ROW = URL + "/rest/v1/prismine_runs?id=eq." + ID;

    private final ObjectMapper mapper = JsonMapper.builder().build();
    private MockRestServiceServer server;
    private SupabaseRunRepository runs;
    private SupabaseScoreRegistry scores;

    @BeforeEach
    void setUp() {
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(URL, "anon", "service", "jwt-secret", Duration.ofHours(1)));
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        PrismineSupabase supabase = new PrismineSupabase(builder, props);
        runs = new SupabaseRunRepository(supabase, mapper);
        scores = new SupabaseScoreRegistry(supabase);
    }

    @Test
    void storesRunsAndScoresInSupabaseAndReportsItsFailures() throws Exception {
        Run run = Expedition.start(ID, "joueur-1", 42, Instant.parse("2026-11-03T10:00:00Z"));
        String json = mapper.writeValueAsString(run);
        server.expect(requestTo(URL + "/rest/v1/prismine_runs"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("apikey", "service"))
                .andExpect(header("Authorization", "Bearer service"))
                .andExpect(content().json("{\"id\": \"" + ID + "\", \"user_id\": \"joueur-1\", \"version\": 0}"))
                .andRespond(withSuccess());
        server.expect(requestTo(ROW + "&select=state"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[{\"state\": " + json + "}]", MediaType.APPLICATION_JSON));
        // Mise à jour conditionnelle : acceptée sur la version attendue, refusée (409) si une autre requête est passée.
        server.expect(requestTo(ROW + "&version=eq.0"))
                .andExpect(method(HttpMethod.PATCH))
                .andExpect(header("Prefer", "return=representation"))
                .andExpect(content().json("{\"version\": 1}"))
                .andRespond(withSuccess("[{\"version\": 1}]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(ROW + "&version=eq.0"))
                .andExpect(method(HttpMethod.PATCH))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(ROW)).andExpect(method(HttpMethod.DELETE)).andRespond(withSuccess());
        server.expect(requestTo(URL + "/rest/v1/prismine_runs?user_id=eq.joueur-1"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withSuccess());
        server.expect(requestTo(URL + "/rest/v1/prismine_runs?updated_at=lt.2026-11-02T10:00:00Z"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withSuccess());
        server.expect(requestTo(ROW + "&select=state")).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(URL + "/rest/v1/scores"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content()
                        .json("{\"user_id\": \"joueur-1\", \"game_slug\": \"prismine\", \"score\": 150,"
                                + " \"metadata\": {\"depth\": 2, \"runId\": \"" + ID + "\"}}"))
                .andRespond(withSuccess());
        // Score déjà classé (index unique sur metadata.runId) : PostgREST répond 409, ce n'est pas une erreur.
        server.expect(requestTo(URL + "/rest/v1/scores")).andRespond(withStatus(HttpStatus.CONFLICT));
        server.expect(requestTo(URL + "/rest/v1/scores")).andRespond(withServerError());

        // Expédition : écrite, relue depuis son état JSON, mise à jour, puis supprimée (par id, par joueur, par purge).
        runs.insert(run);
        assertThat(runs.find(ID)).contains(run);
        runs.update(run.nextVersion());
        assertThatThrownBy(() -> runs.update(run.nextVersion()))
                .isInstanceOf(ApiException.class)
                .hasMessage(RunRepository.CONFLICT)
                .extracting("status")
                .isEqualTo(HttpStatus.CONFLICT);
        runs.delete(ID);
        runs.deleteByUser("joueur-1");
        runs.deleteInactiveSince(Instant.parse("2026-11-02T10:00:00Z"));
        assertThat(runs.find(ID)).isEmpty();
        // Score : inséré au nom du joueur, une seule fois par expédition ; une panne devient une 502 lisible.
        scores.record(ID, "joueur-1", 150, Map.of("depth", 2));
        scores.record(ID, "joueur-1", 150, Map.of("depth", 2));
        assertThatThrownBy(() -> scores.record(ID, "joueur-1", 150, Map.of()))
                .isInstanceOf(ApiException.class)
                .hasMessage("Le serveur de Prismine rencontre un problème. Réessaie plus tard.")
                .extracting("status")
                .isEqualTo(HttpStatus.BAD_GATEWAY);
        server.verify();
    }
}
