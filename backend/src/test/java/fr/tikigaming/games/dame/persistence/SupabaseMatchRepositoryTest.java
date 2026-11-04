package fr.tikigaming.games.dame.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fr.tikigaming.config.TikiProperties;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.matches.Match;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Contrat HTTP et pannes sans réseau ; les *IT vérifient séparément le fournisseur réel. */
class SupabaseMatchRepositoryTest {

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000018");
    private static final String URL = "https://ref.supabase.invalid/rest/v1/dame_matches";
    private static final String LOOKUP = URL + "?id=eq." + ID;
    private static final String CLOSING = LOOKUP + "&status=eq.IN_PROGRESS";
    private static final Instant START = Instant.parse("2026-11-04T12:00:00.123456Z");
    private static final Instant END = START.plusSeconds(600);
    private static final String ROW = """
            {"id":"00000000-0000-0000-0000-000000000018", "white_name":"Cherif", "black_name":"Amadou",
             "started_at":"2026-11-04T12:00:00.123456+00:00", "status":"IN_PROGRESS", "finished_at":null}
            """;

    private MockRestServiceServer server;
    private SupabaseMatchRepository repository;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(
                        "https://ref.supabase.invalid",
                        "anon",
                        "test-service-key",
                        "test-secret",
                        Duration.ofHours(1)));
        repository = new DamePersistenceConfiguration()
                .dameMatchRepository(builder, props, JsonMapper.builder().build());
    }

    @Test
    void createsWithTheServerKeyAndMicrosecondDates() {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("apikey", "test-service-key"))
                .andExpect(header("Authorization", "Bearer test-service-key"))
                .andExpect(header("Prefer", "return=minimal"))
                .andExpect(content().json(ROW.replace("+00:00", "Z")))
                .andRespond(withStatus(HttpStatus.CREATED));

        repository.save(Match.start(ID, "Cherif", "Amadou", START.plusNanos(789)));

        server.verify();
    }

    @Test
    void readsTheStoredMatch() {
        server.expect(requestTo(LOOKUP))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[" + ROW + "]", MediaType.APPLICATION_JSON));

        assertThat(repository.findById(ID)).contains(Match.start(ID, "Cherif", "Amadou", START));
        server.verify();
    }

    @Test
    void anEmptyArrayMeansUnknownIdentifier() {
        server.expect(requestTo(LOOKUP)).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        assertThat(repository.findById(ID)).isEmpty();
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"WHITE_WON", "BLACK_WON"})
    void readsBothFinishedStates(String status) {
        String row = ROW.replace("IN_PROGRESS", status).replace("null", "\"" + END + "\"");
        server.expect(requestTo(LOOKUP)).andRespond(withSuccess("[" + row + "]", MediaType.APPLICATION_JSON));

        assertThat(repository.findById(ID))
                .contains(new Match(ID, "Cherif", "Amadou", START, GameStatus.valueOf(status), END));
    }

    @Test
    void onlyPatchesTheResultOfAnInProgressMatch() {
        String finishedRow = ROW.replace("IN_PROGRESS", "WHITE_WON").replace("null", "\"" + END + "\"");
        server.expect(requestTo(CLOSING))
                .andExpect(method(HttpMethod.PATCH))
                .andExpect(header("Prefer", "return=representation"))
                .andExpect(content().json("{\"status\":\"WHITE_WON\",\"finished_at\":\"" + END + "\"}"))
                .andRespond(withSuccess("[" + finishedRow + "]", MediaType.APPLICATION_JSON));

        repository.save(Match.start(ID, "Cherif", "Amadou", START).finish(GameStatus.WHITE_WON, END.plusNanos(789)));

        server.verify();
    }

    @Test
    void zeroUpdatedRowsMeansUnknownOrAlreadyFinished() {
        server.expect(requestTo(CLOSING)).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> repository.save(
                        Match.start(ID, "Cherif", "Amadou", START).finish(GameStatus.BLACK_WON, END)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void anExistingIdentifierIsAConflict() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.CONFLICT));

        assertThatThrownBy(() -> repository.save(Match.start(ID, "Cherif", "Amadou", START)))
                .isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 401, 403, 404, 429, 500, 503})
    void providerFailuresDoNotLeakTheirBody(int status) {
        server.expect(requestTo(LOOKUP))
                .andRespond(withStatus(HttpStatus.valueOf(status)).body("internal-sensitive-provider-detail"));

        assertThatThrownBy(() -> repository.findById(ID))
                .isInstanceOf(MatchStorageException.class)
                .hasMessage("Le stockage des rencontres est indisponible. Réessaie plus tard.");
    }

    @Test
    void aNetworkFailureIsNotReportedAsAnUnknownMatch() {
        server.expect(requestTo(LOOKUP)).andRespond(withException(new IOException("connection refused")));

        assertThatThrownBy(() -> repository.findById(ID)).isInstanceOf(MatchStorageException.class);
    }

    @Test
    void aFailedCreationIsNotReportedAsASuccess() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> repository.save(Match.start(ID, "Cherif", "Amadou", START)))
                .isInstanceOf(MatchStorageException.class);
    }

    @Test
    void aFailedClosingIsNotReportedAsASuccess() {
        server.expect(requestTo(CLOSING)).andRespond(withException(new IOException("connection refused")));

        assertThatThrownBy(() -> repository.save(
                        Match.start(ID, "Cherif", "Amadou", START).finish(GameStatus.WHITE_WON, END)))
                .isInstanceOf(MatchStorageException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null", "{}", "[{}]", "[", "[{},{}]"})
    void invalidResponsesAreNotTreatedAsMissingMatches(String body) {
        server.expect(requestTo(LOOKUP)).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> repository.findById(ID)).isInstanceOf(MatchStorageException.class);
    }

    @Test
    void aResponseForAnotherIdentifierIsRefused() {
        String otherRow = ROW.replace("000000000018", "000000000019");
        server.expect(requestTo(LOOKUP)).andRespond(withSuccess("[" + otherRow + "]", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> repository.findById(ID)).isInstanceOf(MatchStorageException.class);
    }
}
