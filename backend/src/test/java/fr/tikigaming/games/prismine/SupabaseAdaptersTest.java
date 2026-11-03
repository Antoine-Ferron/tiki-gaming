package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import fr.tikigaming.config.TikiProperties;
import fr.tikigaming.games.GameException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * TI — adaptateurs Supabase (PostgREST) avec le vrai client HTTP de Spring et la sérialisation JSON : on vérifie les
 * requêtes envoyées à un serveur simulé ({@link MockRestServiceServer}), sans réseau.
 */
class SupabaseAdaptersTest {

    private static final String URL = "https://ref.supabase.co";
    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String ROW = URL + "/rest/v1/prismine_runs?id=eq." + ID;

    private final ObjectMapper mapper = JsonMapper.builder().findAndAddModules().build();
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
    void savesReadsBackAndDeletesARunWithTheServiceRoleKey() throws Exception {
        Run run = Expedition.start(ID, "joueur-1", 42, Instant.parse("2026-11-03T10:00:00Z"));
        server.expect(requestTo(URL + "/rest/v1/prismine_runs"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("apikey", "service"))
                .andExpect(header("Authorization", "Bearer service"))
                .andExpect(header("Prefer", "resolution=merge-duplicates"))
                .andExpect(content().json("{\"id\": \"" + ID + "\", \"user_id\": \"joueur-1\"}"))
                .andRespond(withSuccess());
        server.expect(requestTo(ROW + "&select=state"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(
                        "[{\"state\": " + mapper.writeValueAsString(run) + "}]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(ROW)).andExpect(method(HttpMethod.DELETE)).andRespond(withSuccess());
        server.expect(requestTo(ROW + "&select=state")).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        runs.save(run);
        assertThat(runs.find(ID)).contains(run);
        runs.delete(ID);
        assertThat(runs.find(ID)).isEmpty();
        server.verify();
    }

    @Test
    void insertsTheScoreAndTurnsASupabaseFailureIntoABadGateway() {
        server.expect(requestTo(URL + "/rest/v1/scores"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content()
                        .json("{\"user_id\": \"joueur-1\", \"game_slug\": \"prismine\", \"score\": 150,"
                                + " \"metadata\": {\"depth\": 2}}"))
                .andRespond(withSuccess());
        server.expect(requestTo(URL + "/rest/v1/scores")).andRespond(withServerError());

        scores.record("joueur-1", 150, Map.of("depth", 2));
        assertThatThrownBy(() -> scores.record("joueur-1", 150, Map.of()))
                .isInstanceOf(GameException.class)
                .hasMessage("Le serveur de Prismine rencontre un problème. Réessaie plus tard.")
                .extracting("status")
                .isEqualTo(502);
        server.verify();
    }
}
