package fr.tikigaming.games.dame.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.matches.GameSave;
import fr.tikigaming.games.dame.matches.Match;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Contrat transactionnel du port, contrôlé à travers le vrai PostgREST et les migrations réelles. */
class DameGameSaveIT {
    private static final DameDatabase DATABASE = new DameDatabase();
    private static SupabaseGameSaveRepository repository;
    private static final String OWNER = "a".repeat(64);
    private static final String INITIAL = "{\"view\":{\"version\":0},\"history\":{}}";
    private static final String NEXT = "{\"view\":{\"version\":1},\"history\":{}}";

    @BeforeAll
    static void start() throws Exception {
        DATABASE.start();
        repository = new SupabaseGameSaveRepository(
                RestClient.builder()
                        .baseUrl(DATABASE.restUrl())
                        .defaultHeader("Authorization", "Bearer " + DATABASE.serviceToken())
                        .build(),
                JsonMapper.builder().build());
    }

    @AfterAll
    static void close() {
        DATABASE.close();
    }

    private GameSave initial() {
        GameSave save = new GameSave(
                Match.start(UUID.randomUUID(), "Chérif", "Amadou", Instant.parse("2026-11-06T10:00:00Z")),
                OWNER,
                0,
                INITIAL);
        repository.save(save);
        return save;
    }

    @Test
    void createsReadsAndAdvancesWithoutExposingTheStateToAnotherOwner() {
        GameSave save = initial();
        assertThat(repository.findOwned(save.match().id(), "b".repeat(64))).isEmpty();
        assertThat(repository.findOwned(UUID.randomUUID(), OWNER)).isEmpty();
        GameSave next = new GameSave(save.match(), OWNER, 1, NEXT);
        repository.save(next);
        GameSave loaded = repository.findOwned(save.match().id(), OWNER).orElseThrow();
        assertThat(loaded.match()).isEqualTo(save.match());
        assertThat(loaded.version()).isEqualTo(1);
        assertThat(JsonMapper.builder()
                        .build()
                        .readTree(loaded.state())
                        .path("view")
                        .path("version")
                        .intValue())
                .isEqualTo(1);
        assertThatThrownBy(() -> repository.save(next)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsWrongOwnerAndChangedNamesWithoutChangingState() {
        GameSave save = initial();
        assertThatThrownBy(() -> repository.save(new GameSave(save.match(), "b".repeat(64), 1, NEXT)))
                .isInstanceOf(IllegalStateException.class);
        Match renamed =
                Match.start(save.match().id(), "Autre", "Amadou", save.match().startedAt());
        assertThatThrownBy(() -> repository.save(new GameSave(renamed, OWNER, 1, NEXT)))
                .isInstanceOf(MatchStorageException.class);
        assertThat(repository.findOwned(save.match().id(), OWNER).orElseThrow().version())
                .isZero();
    }

    @Test
    void invalidSnapshotRollsBackTheResultInTheSameTransaction() {
        GameSave save = initial();
        Match ended =
                save.match().finish(GameStatus.DRAW, save.match().startedAt().plusSeconds(1));
        assertThatThrownBy(() -> repository.save(new GameSave(ended, OWNER, 1, "{}")))
                .isInstanceOf(MatchStorageException.class);
        GameSave unchanged = repository.findOwned(save.match().id(), OWNER).orElseThrow();
        assertThat(unchanged.version()).isZero();
        assertThat(unchanged.match()).isEqualTo(save.match());
    }

    @Test
    void failedCreationLeavesNeitherMatchNorSave() throws Exception {
        UUID id = UUID.randomUUID();
        Match match = Match.start(id, "A", "B", Instant.parse("2026-11-06T10:00:00Z"));
        assertThatThrownBy(() -> repository.save(new GameSave(match, OWNER, 0, "{}")))
                .isInstanceOf(MatchStorageException.class);
        try (var connection = DATABASE.connect();
                var query = connection.prepareStatement("select count(*) from dame_matches where id = ?")) {
            query.setObject(1, id);
            try (var rows = query.executeQuery()) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getInt(1)).isZero();
            }
        }
    }

    @Test
    void simultaneousCommandsFromTwoProcessesCanAdvanceTheVersionOnlyOnce() throws Exception {
        GameSave save = initial();
        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<Boolean> command = () -> {
            barrier.await(5, TimeUnit.SECONDS);
            try {
                repository.save(new GameSave(save.match(), OWNER, 1, NEXT));
                return true;
            } catch (IllegalStateException stale) {
                return false;
            }
        };
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(command);
            var second = executor.submit(command);
            assertThat(first.get(10, TimeUnit.SECONDS) ^ second.get(10, TimeUnit.SECONDS))
                    .isTrue();
        }
        assertThat(repository.findOwned(save.match().id(), OWNER).orElseThrow().version())
                .isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"WHITE_WON", "BLACK_WON", "DRAW"})
    void finalResultAndBoardAreCommittedTogetherAndCannotBeOverwritten(String status) {
        GameSave save = initial();
        Match ended = save.match()
                .finish(GameStatus.valueOf(status), save.match().startedAt().plusSeconds(1));
        repository.save(new GameSave(ended, OWNER, 1, NEXT));
        GameSave loaded = repository.findOwned(save.match().id(), OWNER).orElseThrow();
        assertThat(loaded.match()).isEqualTo(ended);
        assertThat(loaded.version()).isEqualTo(1);
        assertThatThrownBy(() -> repository.save(new GameSave(ended, OWNER, 2, NEXT)))
                .isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"anon", "authenticated"})
    void browserRolesCannotReadTheSaveOrCallTheWriteFunction(String role) throws Exception {
        initial();
        try (var connection = DATABASE.connect();
                var statement = connection.createStatement()) {
            statement.execute("set role " + role);
            assertThatThrownBy(() -> statement.executeQuery("select * from public.dame_game_saves"))
                    .isInstanceOf(java.sql.SQLException.class)
                    .hasMessageContaining("permission denied");
            assertThatThrownBy(() -> statement.executeQuery(
                            "select public.dame_save_game(null,null,null,null,null,null,null,null,null)"))
                    .isInstanceOf(java.sql.SQLException.class)
                    .hasMessageContaining("permission denied");
        }
    }
}
