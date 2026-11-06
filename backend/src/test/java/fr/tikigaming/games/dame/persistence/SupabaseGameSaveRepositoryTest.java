package fr.tikigaming.games.dame.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.matches.GameSave;
import fr.tikigaming.games.dame.matches.Match;
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

class SupabaseGameSaveRepositoryTest {
    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000018");
    private static final String OWNER = "a".repeat(64);
    private static final String ROOT = "https://storage.invalid";
    private static final String LOOKUP =
            ROOT + "/dame_game_saves?id=eq." + ID + "&owner_hash=eq." + OWNER + "&select=*,dame_matches(*)";
    private static final Instant NOW = Instant.parse("2026-11-06T10:00:00Z");
    private static final Match MATCH = Match.start(ID, "Chérif", "Amadou", NOW);
    private static final String STATE = "{\"view\":{},\"history\":{}}";
    private MockRestServiceServer server;
    private SupabaseGameSaveRepository repository;

    @BeforeEach
    void setUp() {
        var builder = RestClient.builder().baseUrl(ROOT);
        server = MockRestServiceServer.bindTo(builder).build();
        repository = new SupabaseGameSaveRepository(
                builder.build(), JsonMapper.builder().build());
    }

    private String row() {
        return """
                {"id":"%s","owner_hash":"%s","version":0,"state":%s,"dame_matches":
                {"id":"%s","white_name":"Chérif","black_name":"Amadou","started_at":"%s","status":"IN_PROGRESS","finished_at":null}}
                """.formatted(ID, OWNER, STATE, ID, NOW);
    }

    @Test
    void sendsOneAtomicCommandContainingMetadataAndSnapshot() {
        server.expect(requestTo(ROOT + "/rpc/dame_save_game"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("""
                        {"p_id":"%s","p_owner_hash":"%s","p_version":0,"p_state":%s,
                        "p_white_name":"Chérif","p_black_name":"Amadou","p_started_at":"%s",
                        "p_status":"IN_PROGRESS","p_finished_at":null}
                        """.formatted(ID, OWNER, STATE, NOW)))
                .andRespond(withSuccess("true", MediaType.APPLICATION_JSON));
        repository.save(new GameSave(MATCH, OWNER, 0, STATE));
        server.verify();
    }

    @Test
    void sendsTheTerminalDateAndDrawResult() {
        server.expect(requestTo(ROOT + "/rpc/dame_save_game"))
                .andExpect(content().json("{\"p_status\":\"DRAW\",\"p_finished_at\":\"2026-11-06T10:00:01Z\"}"))
                .andRespond(withSuccess("true", MediaType.APPLICATION_JSON));
        repository.save(new GameSave(MATCH.finish(GameStatus.DRAW, NOW.plusSeconds(1)), OWNER, 1, STATE));
        server.verify();
    }

    @Test
    void readsOnlyTheRequestedOwnerAndIdentifier() {
        server.expect(requestTo(LOOKUP))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[" + row() + "]", MediaType.APPLICATION_JSON));
        assertThat(repository.findOwned(ID, OWNER)).contains(new GameSave(MATCH, OWNER, 0, STATE));
        server.verify();
    }

    @Test
    void absenceIsNotAStorageOutage() {
        server.expect(requestTo(LOOKUP)).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        assertThat(repository.findOwned(ID, OWNER)).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null", "{}", "broken", "[{},{}]", "[{}]"})
    void refusesMalformedProviderReplies(String response) {
        server.expect(requestTo(LOOKUP)).andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> repository.findOwned(ID, OWNER)).isInstanceOf(MatchStorageException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "id", "version", "metadata"})
    void refusesForeignOrInvalidStoredData(String corruption) {
        String response = switch (corruption) {
            case "owner" -> row().replace(OWNER, "b".repeat(64));
            case "id" -> row().replaceFirst(ID.toString(), UUID.randomUUID().toString());
            case "version" -> row().replace("\"version\":0", "\"version\":0.5");
            case "metadata" -> row().replace("\"status\":\"IN_PROGRESS\"", "\"status\":\"UNKNOWN\"");
            default -> throw new AssertionError(corruption);
        };
        server.expect(requestTo(LOOKUP)).andRespond(withSuccess("[" + response + "]", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> repository.findOwned(ID, OWNER)).isInstanceOf(MatchStorageException.class);
    }

    @Test
    void staleVersionIsAConflict() {
        server.expect(requestTo(ROOT + "/rpc/dame_save_game"))
                .andRespond(withSuccess("false", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> repository.save(new GameSave(MATCH, OWNER, 1, STATE)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void duplicateIdentityIsAConflict() {
        server.expect(requestTo(ROOT + "/rpc/dame_save_game")).andRespond(withStatus(HttpStatus.CONFLICT));
        assertThatThrownBy(() -> repository.save(new GameSave(MATCH, OWNER, 0, STATE)))
                .isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null", "invalid"})
    void missingAcknowledgementIsAnOutage(String response) {
        server.expect(requestTo(ROOT + "/rpc/dame_save_game"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> repository.save(new GameSave(MATCH, OWNER, 0, STATE)))
                .isInstanceOf(MatchStorageException.class);
    }

    @Test
    void providerFailureIsAnOutage() {
        server.expect(requestTo(LOOKUP)).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertThatThrownBy(() -> repository.findOwned(ID, OWNER)).isInstanceOf(MatchStorageException.class);
    }
}
