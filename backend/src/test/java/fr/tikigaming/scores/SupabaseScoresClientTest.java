package fr.tikigaming.scores;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withCreatedEntity;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.config.TikiProperties;
import fr.tikigaming.resilience.CircuitBreaker;
import java.io.IOException;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Requête d'insertion envoyée à PostgREST et traduction de ses refus, sans réseau. */
class SupabaseScoresClientTest {

    private static final String URL = "https://ref.supabase.co";
    private static final String SERVICE = "service-role-key";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static final int OUTAGES_BEFORE_OPENING = 2;

    private MockRestServiceServer server;
    private CircuitBreaker breaker;
    private SupabaseScoresClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(URL, "anon-key", SERVICE, "jwt-secret", Duration.ofHours(1)));
        breaker = new CircuitBreaker(
                OUTAGES_BEFORE_OPENING, Duration.ofSeconds(30), Clock.systemUTC(), SupabaseScoresClient::isOutage);
        client = new SupabaseScoresClient(builder, props, JSON, breaker);
    }

    private void insertClickerScore() {
        client.insert("u-1", "clicker", 120, JSON.readTree("{\"durationMs\": 10000}"));
    }

    @Test
    void insertsTheScoreOfThePlayerWithTheServiceRoleKey() {
        server.expect(requestTo(URL + "/rest/v1/scores"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("apikey", SERVICE))
                .andExpect(header("Authorization", "Bearer " + SERVICE))
                .andExpect(header("Prefer", "return=minimal"))
                .andExpect(content().json("""
                        {"user_id": "u-1", "game_slug": "clicker", "score": 120, "metadata": {"durationMs": 10000}}"""))
                .andRespond(withCreatedEntity(URI.create(URL + "/rest/v1/scores?id=eq.1")));

        insertClickerScore();

        server.verify();
    }

    @ParameterizedTest(name = "{0} ({1}) → {2}")
    @CsvSource(
            delimiter = '|',
            // Les messages contiennent des apostrophes : pas de guillemets simples comme délimiteur de texte.
            quoteCharacter = '`',
            value = {
                "23503 | insert or update on table \"scores\" violates foreign key constraint \"scores_game_slug_fkey\""
                        + " | 404 | " + SupabaseScoresClient.UNKNOWN_GAME,
                "55000 | Le jeu clicker n'accepte plus de scores | 403 | " + SupabaseScoresClient.CLOSED_GAME,
                "23514 | Score 301 supérieur au maximum du jeu clicker (300) | 400 | "
                        + SupabaseScoresClient.SCORE_TOO_HIGH,
                // Profil absent : ce n'est pas la faute du joueur, ni un jeu inconnu.
                "23503 | insert or update on table \"scores\" violates foreign key constraint \"scores_user_id_fkey\""
                        + " | 502 | " + SupabaseScoresClient.UNAVAILABLE,
                "PGRST301 | JWT expired | 502 | " + SupabaseScoresClient.UNAVAILABLE,
            })
    void translatesTheRefusalOfTheDatabase(String code, String message, int status, String expected) {
        server.expect(requestTo(URL + "/rest/v1/scores"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(JSON.writeValueAsString(Map.of("code", code, "message", message))));

        assertThatThrownBy(this::insertClickerScore).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status().value()).isEqualTo(status);
            assertThat(e.getMessage()).isEqualTo(expected);
        });
    }

    @Test
    void aServerErrorWithoutJsonBodyBecomesABadGateway() {
        server.expect(requestTo(URL + "/rest/v1/scores"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body("<html>indisponible</html>"));

        assertThatThrownBy(this::insertClickerScore)
                .isInstanceOfSatisfying(
                        ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void anUnreachableSupabaseBecomesABadGateway() {
        server.expect(requestTo(URL + "/rest/v1/scores")).andRespond(withException(new IOException("refusé")));

        assertThatThrownBy(this::insertClickerScore)
                .isInstanceOf(ApiException.class)
                .hasMessage(SupabaseScoresClient.UNAVAILABLE);
    }

    @Test
    void afterRepeatedOutagesTheCircuitOpensAndSupabaseIsNoLongerCalled() {
        server.expect(ExpectedCount.times(OUTAGES_BEFORE_OPENING), requestTo(URL + "/rest/v1/scores"))
                .andRespond(withException(new IOException("délai dépassé")));
        for (int i = 0; i < OUTAGES_BEFORE_OPENING; i++) {
            assertThatThrownBy(this::insertClickerScore)
                    .isInstanceOfSatisfying(
                            ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.BAD_GATEWAY));
        }

        // Disjoncteur ouvert : réponse immédiate, sans requête (sinon MockRestServiceServer échoue).
        assertThatThrownBy(this::insertClickerScore).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
            assertThat(e).hasMessage(SupabaseScoresClient.UNAVAILABLE);
        });
        server.verify();
    }

    @Test
    void refusalsOfTheDatabaseAreNotOutagesAndKeepTheCircuitClosed() {
        server.expect(ExpectedCount.times(OUTAGES_BEFORE_OPENING + 1), requestTo(URL + "/rest/v1/scores"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"code": "23514", "message": "Score 999 supérieur au maximum"}"""));

        for (int i = 0; i <= OUTAGES_BEFORE_OPENING; i++) {
            assertThatThrownBy(this::insertClickerScore)
                    .isInstanceOfSatisfying(
                            ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST));
        }
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
    }
}
