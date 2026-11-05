package fr.tikigaming.games.dame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import fr.tikigaming.games.dame.matches.MatchRepository;
import fr.tikigaming.games.dame.persistence.DameDatabase;
import fr.tikigaming.games.dame.persistence.SupabaseMatchRepository;
import jakarta.servlet.http.Cookie;
import java.sql.Connection;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
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
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Chaîne Spring/CSRF → cas d'usage → vrai PostgREST → vrai PostgreSQL, sans doublure de persistance. */
@SpringBootTest(
        properties = {
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://persistence-test.supabase.invalid",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@AutoConfigureMockMvc
@Import(DameApiPersistenceIT.Persistence.class)
class DameApiPersistenceIT {

    private static final DameDatabase DATABASE = startDatabase();
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String ROOT = "/api/games/dame/matches";

    private static DameDatabase startDatabase() {
        DameDatabase database = new DameDatabase();
        try {
            database.start();
            return database;
        } catch (Exception error) {
            throw new ExceptionInInitializerError(error);
        }
    }

    @TestConfiguration
    static class Persistence {
        @Bean
        @Primary
        MatchRepository liveDameRepository() throws Exception {
            return new SupabaseMatchRepository(
                    RestClient.builder()
                            .baseUrl(DATABASE.restUrl())
                            .defaultHeader("Authorization", "Bearer " + DATABASE.serviceToken())
                            .build(),
                    JSON);
        }
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    MatchRepository repository;

    private MockHttpSession owner;
    private Cookie csrf;

    @BeforeEach
    void setUp() throws Exception {
        try (Connection connection = DATABASE.connect();
                var statement = connection.createStatement()) {
            statement.execute("truncate public.dame_matches");
        }
        owner = new MockHttpSession();
        csrf = mvc.perform(get("/api/auth/session").session(owner))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        assertThat(csrf).isNotNull();
    }

    @AfterAll
    static void stopContainers() {
        DATABASE.close();
    }

    private DameGameView create() throws Exception {
        byte[] response = mvc.perform(post(ROOT)
                        .session(owner)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"whiteName\":\" Chérif \",\"blackName\":\"Amadou\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        return JSON.readValue(response, DameGameView.class);
    }

    @Test
    void createsAndFinishesThroughTheRealApiAndDatabase() throws Exception {
        DameGameView created = create();
        assertThat(repository.findById(created.id()).orElseThrow().whiteName()).isEqualTo("Chérif");
        Game nearVictory = new Game(
                new Board(Map.of(
                        new Position(6, 1), new Piece(Player.WHITE, false),
                        new Position(5, 2), new Piece(Player.BLACK, false))),
                Player.WHITE);
        // Fixture de milieu de partie dans la session de test, aucune route publique d'injection de plateau.
        owner.setAttribute(
                DameApplicationService.ATTRIBUTE,
                JSON.writeValueAsString(
                        DameGameView.of(repository.findById(created.id()).orElseThrow(), nearVictory, 7)));

        String path = ROOT + "/" + created.id();
        mvc.perform(
                        post(path + "/moves")
                                .session(owner)
                                .cookie(csrf)
                                .header("X-XSRF-TOKEN", csrf.getValue())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"version\":7,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":4,\"column\":3}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.winner").value("WHITE"))
                .andExpect(jsonPath("$.version").value(8));

        try (Connection connection = DATABASE.connect();
                var query = connection.prepareStatement(
                        "select white_name, black_name, status, finished_at from dame_matches where id = ?")) {
            query.setObject(1, created.id());
            try (var rows = query.executeQuery()) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString("white_name")).isEqualTo("Chérif");
                assertThat(rows.getString("black_name")).isEqualTo("Amadou");
                assertThat(rows.getString("status")).isEqualTo("WHITE_WON");
                assertThat(rows.getTimestamp("finished_at")).isNotNull();
                assertThat(rows.next()).isFalse();
            }
        }
        mvc.perform(get(path).session(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WHITE_WON"));
        var finished = repository.findById(created.id()).orElseThrow();
        mvc.perform(
                        post(path + "/moves")
                                .session(owner)
                                .cookie(csrf)
                                .header("X-XSRF-TOKEN", csrf.getValue())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"version\":8,\"from\":{\"row\":4,\"column\":3},\"landings\":[{\"row\":3,\"column\":2}]}"))
                .andExpect(status().isConflict());
        assertThat(repository.findById(created.id())).contains(finished);
    }

    @Test
    void legalMoveAndRefusedCommandsKeepThePersistedMatchUnfinished() throws Exception {
        DameGameView created = create();
        var initialRow = repository.findById(created.id()).orElseThrow();
        String path = ROOT + "/" + created.id();
        String ordinaryMove =
                "{\"version\":0,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":5,\"column\":0}]}";

        mvc.perform(
                        post(path + "/moves")
                                .session(owner)
                                .cookie(csrf)
                                .header("X-XSRF-TOKEN", csrf.getValue())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"version\":0,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":4,\"column\":1}]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path).session(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(0));
        mvc.perform(post(path + "/moves")
                        .session(owner)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ordinaryMove))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.currentPlayer").value("BLACK"));
        mvc.perform(post(path + "/moves")
                        .session(owner)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ordinaryMove))
                .andExpect(status().isConflict());
        mvc.perform(get(path).session(owner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));
        assertThat(repository.findById(created.id())).contains(initialRow);
    }

    @Test
    void invalidNamesAndMissingCsrfCannotInsertARealRow() throws Exception {
        mvc.perform(post(ROOT)
                        .session(owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"whiteName\":\"Cherif\",\"blackName\":\"Amadou\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(ROOT)
                        .session(owner)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"whiteName\":\" \",\"blackName\":\"Amadou\"}"))
                .andExpect(status().isBadRequest());
        try (Connection connection = DATABASE.connect();
                var statement = connection.createStatement();
                var rows = statement.executeQuery("select count(*) from public.dame_matches")) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getLong(1)).isZero();
        }
        assertThat(owner.getAttribute(DameApplicationService.ATTRIBUTE)).isNull();
    }

    @Test
    void foreignHttpSessionCannotChangeTheRealStoredMatch() throws Exception {
        DameGameView created = create();
        MockHttpSession stranger = new MockHttpSession();
        String path = ROOT + "/" + created.id();
        mvc.perform(get(path).session(stranger)).andExpect(status().isNotFound());
        mvc.perform(
                        post(path + "/moves")
                                .session(stranger)
                                .cookie(csrf)
                                .header("X-XSRF-TOKEN", csrf.getValue())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"version\":0,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":5,\"column\":0}]}"))
                .andExpect(status().isNotFound());
        assertThat(repository.findById(created.id()).orElseThrow().status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(stranger.getAttribute(DameApplicationService.ATTRIBUTE)).isNull();
    }
}
