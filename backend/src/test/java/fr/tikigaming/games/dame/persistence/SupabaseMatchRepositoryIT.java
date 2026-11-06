package fr.tikigaming.games.dame.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import fr.tikigaming.games.dame.matches.Match;
import fr.tikigaming.games.dame.matches.MatchService;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Intégration réelle de l'adaptateur HTTP, des migrations et des droits ; aucun mock ni fake. */
class SupabaseMatchRepositoryIT {

    @Test
    void persistsADrawWithoutAWinnerAndRefusesASecondClosure() {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);
        repository.save(initial);
        Match draw = initial.finish(GameStatus.DRAW, END);
        repository.save(draw);
        assertThat(repository.findById(ID)).contains(draw);
        assertThat(repository.findById(ID).orElseThrow().winner()).isEmpty();
        assertThatThrownBy(() -> repository.save(initial.finish(GameStatus.WHITE_WON, END)))
                .isInstanceOf(IllegalStateException.class);
    }

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000018");
    private static final Instant START = Instant.parse("2026-11-04T12:00:00.123456Z");
    private static final Instant END = START.plusSeconds(600);
    private static final DameDatabase DATABASE = new DameDatabase();
    private static SupabaseMatchRepository repository;

    @BeforeAll
    static void startContainersAndApplyEveryMigration() throws Exception {
        DATABASE.start();
        repository = new SupabaseMatchRepository(
                RestClient.builder()
                        .baseUrl(DATABASE.restUrl())
                        .defaultHeaders(h -> h.setBearerAuth(serviceToken()))
                        .build(),
                JsonMapper.builder().build());
    }

    private static String serviceToken() {
        try {
            return DATABASE.serviceToken();
        } catch (Exception e) {
            throw new IllegalStateException("JWT du conteneur de test impossible à construire", e);
        }
    }

    @AfterAll
    static void stopContainers() {
        DATABASE.close();
    }

    @BeforeEach
    void isolateTestData() throws SQLException {
        try (Connection connection = DATABASE.connect();
                var statement = connection.createStatement()) {
            statement.execute("truncate public.dame_matches");
        }
    }

    @Test
    void createsAndReadsThroughTheRealHttpAdapter() throws SQLException {
        MatchService service = new MatchService(repository, Clock.fixed(START, ZoneOffset.UTC), () -> ID);

        Match created = service.start(" Chérif ", " Amadou ");

        assertThat(repository.findById(ID)).contains(created);
        try (Connection connection = DATABASE.connect();
                var statement = connection.createStatement();
                var rows = statement.executeQuery(
                        "select white_name, black_name, status, finished_at from dame_matches")) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getString("white_name")).isEqualTo("Chérif");
            assertThat(rows.getString("black_name")).isEqualTo("Amadou");
            assertThat(rows.getString("status")).isEqualTo("IN_PROGRESS");
            assertThat(rows.getTimestamp("finished_at")).isNull();
            assertThat(rows.next()).isFalse();
        }
    }

    @Test
    void readingAnUnknownIdentifierReturnsEmpty() {
        assertThat(repository.findById(ID)).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(Player.class)
    void storesTheWinnerComputedByTheEngine(Player winner) {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);
        repository.save(initial);
        assertThat(repository.findById(ID)).contains(initial);
        Player next = winner == Player.WHITE ? Player.BLACK : Player.WHITE;
        Game game = new Game(new Board(Map.of(new Position(4, 5), new Piece(winner, false))), next);
        MatchService service = new MatchService(repository, Clock.fixed(END, ZoneOffset.UTC), () -> ID);

        Match finished = service.finish(ID, game);

        assertThat(repository.findById(ID)).contains(finished);
        assertThat(finished.winner()).contains(winner);
        assertThat(finished.finishedAt()).isEqualTo(END);
    }

    @Test
    void cannotCreateTheSameIdentifierTwice() {
        repository.save(Match.start(ID, "Cherif", "Amadou", START));

        assertThatThrownBy(() -> repository.save(Match.start(ID, "Autre", "Nom", START)))
                .isInstanceOf(IllegalStateException.class);
        assertThat(repository.findById(ID)).contains(Match.start(ID, "Cherif", "Amadou", START));
    }

    @Test
    void cannotInsertAResultForAnUnknownMatch() {
        Match result = Match.start(ID, "Cherif", "Amadou", START).finish(GameStatus.WHITE_WON, END);

        assertThatThrownBy(() -> repository.save(result)).isInstanceOf(IllegalStateException.class);
        assertThat(repository.findById(ID)).isEmpty();
    }

    @Test
    void cannotReplaceAResultFromAStaleSnapshot() {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);
        repository.save(initial);
        Match firstResult = initial.finish(GameStatus.WHITE_WON, END);
        repository.save(firstResult);

        assertThatThrownBy(() -> repository.save(initial.finish(GameStatus.BLACK_WON, END.plusSeconds(1))))
                .isInstanceOf(IllegalStateException.class);
        assertThat(repository.findById(ID)).contains(firstResult);
    }

    @Test
    void onlyOneOfTwoConcurrentResultsIsAccepted() throws Exception {
        Match initial = Match.start(ID, "Cherif", "Amadou", START);
        repository.save(initial);
        CyclicBarrier barrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> white = closing(barrier, initial.finish(GameStatus.WHITE_WON, END));
            Callable<Boolean> black = closing(barrier, initial.finish(GameStatus.BLACK_WON, END));
            var whiteResult = executor.submit(white);
            var blackResult = executor.submit(black);

            assertThat(List.of(whiteResult.get(10, TimeUnit.SECONDS), blackResult.get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
            assertThat(repository.findById(ID)).isPresent();
            assertThat(repository.findById(ID).orElseThrow().status()).isIn(GameStatus.WHITE_WON, GameStatus.BLACK_WON);
        }
    }

    private static Callable<Boolean> closing(CyclicBarrier barrier, Match result) {
        return () -> {
            barrier.await(5, TimeUnit.SECONDS);
            try {
                repository.save(result);
                return true;
            } catch (IllegalStateException expectedConflict) {
                return false;
            }
        };
    }

    @Test
    void usesPostgresMicrosecondPrecisionForBothDates() {
        Match initial = Match.start(ID, "Cherif", "Amadou", START.plusNanos(789));
        repository.save(initial);
        Match finished = initial.finish(GameStatus.BLACK_WON, END.plusNanos(789));
        repository.save(finished);

        assertThat(repository.findById(ID))
                .contains(new Match(
                        ID,
                        "Cherif",
                        "Amadou",
                        START.truncatedTo(ChronoUnit.MICROS),
                        GameStatus.BLACK_WON,
                        END.truncatedTo(ChronoUnit.MICROS)));
    }

    @ParameterizedTest
    @MethodSource("invalidNames")
    void databaseRejectsInvalidNamesEvenWhenJavaIsBypassed(String white, String black) throws SQLException {
        try (Connection connection = asRole("service_role")) {
            assertThatThrownBy(() -> insert(connection, white, black, START, "IN_PROGRESS", null))
                    .isInstanceOfSatisfying(
                            SQLException.class, e -> assertThat(e.getSQLState()).isIn("23514", "23502"));
        }
    }

    static Stream<Arguments> invalidNames() {
        return Stream.of(
                Arguments.of(null, "Amadou"),
                Arguments.of("Cherif", null),
                Arguments.of("", "Amadou"),
                Arguments.of("Cherif", ""),
                Arguments.of(" ", "Amadou"),
                Arguments.of("Cherif", "\t\n"),
                Arguments.of(" Cherif", "Amadou"),
                Arguments.of("Cherif", "Amadou "),
                Arguments.of("\u2003Cherif", "Amadou"),
                Arguments.of("a".repeat(51), "Amadou"),
                Arguments.of("Cherif", "a".repeat(51)),
                Arguments.of("\uD83D\uDE00".repeat(25) + "a", "Amadou"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"A", "Chérif Diallo", "Alex", "\u00A0"})
    void databaseAcceptsValidAndHomonymousNames(String name) throws SQLException {
        try (Connection connection = asRole("service_role")) {
            insert(connection, name, name, START, "IN_PROGRESS", null);
        }
    }

    @Test
    void databaseAcceptsTheFiftyUtf16UnitBoundary() throws SQLException {
        try (Connection connection = asRole("service_role")) {
            insert(connection, "é".repeat(50), "\uD83D\uDE00".repeat(25), START, "IN_PROGRESS", null);
        }
    }

    @ParameterizedTest
    @MethodSource("invalidStates")
    void databaseRejectsInvalidStates(Instant start, String status, Instant end) throws SQLException {
        try (Connection connection = asRole("service_role")) {
            assertThatThrownBy(() -> insert(connection, "Cherif", "Amadou", start, status, end))
                    .isInstanceOfSatisfying(
                            SQLException.class, e -> assertThat(e.getSQLState()).isIn("23514", "23502"));
        }
    }

    static Stream<Arguments> invalidStates() {
        return Stream.of(
                Arguments.of(null, "IN_PROGRESS", null),
                Arguments.of(START, null, null),
                Arguments.of(START, "DRAW", null),
                Arguments.of(START, "IN_PROGRESS", END),
                Arguments.of(START, "WHITE_WON", null),
                Arguments.of(START, "BLACK_WON", START.minusSeconds(1)),
                Arguments.of(START, "WHITE_WON", END));
    }

    @Test
    void databaseRefusesASecondClosingEvenWithoutTheHttpFilter() throws SQLException {
        try (Connection connection = asRole("service_role");
                var statement = connection.createStatement()) {
            insert(connection, "Cherif", "Amadou", START, "IN_PROGRESS", null);
            statement.executeUpdate("update dame_matches set status = 'WHITE_WON', finished_at = started_at");

            assertThatThrownBy(() -> statement.executeUpdate("update dame_matches set status = 'BLACK_WON'"))
                    .isInstanceOfSatisfying(
                            SQLException.class, e -> assertThat(e.getSQLState()).isEqualTo("55000"));
        }
    }

    @Test
    void databaseRefusesAnUpdateThatDoesNotCloseTheMatch() throws SQLException {
        try (Connection connection = asRole("service_role");
                var statement = connection.createStatement()) {
            insert(connection, "Cherif", "Amadou", START, "IN_PROGRESS", null);

            assertThatThrownBy(() -> statement.executeUpdate("update dame_matches set status = 'IN_PROGRESS'"))
                    .isInstanceOfSatisfying(
                            SQLException.class, e -> assertThat(e.getSQLState()).isEqualTo("55000"));
        }
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "id = '00000000-0000-0000-0000-000000000019'",
                "white_name = 'Autre'",
                "black_name = 'Autre'",
                "started_at = started_at + interval '1 second'"
            })
    void evenTheTableOwnerCannotRewriteMatchIdentity(String assignment) throws SQLException {
        try (Connection connection = DATABASE.connect();
                var statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            insert(connection, "Cherif", "Amadou", START, "IN_PROGRESS", null);

            assertThatThrownBy(() -> statement.executeUpdate("update dame_matches set " + assignment))
                    .isInstanceOfSatisfying(
                            SQLException.class, e -> assertThat(e.getSQLState()).isEqualTo("23514"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"id", "white_name", "black_name", "started_at"})
    void serverCannotModifyMatchIdentity(String column) throws SQLException {
        try (Connection connection = asRole("service_role");
                var statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.executeUpdate("update dame_matches set " + column + " = " + column))
                    .isInstanceOfSatisfying(
                            SQLException.class, e -> assertThat(e.getSQLState()).isEqualTo("42501"));
        }
    }

    @ParameterizedTest
    @MethodSource("browserOperations")
    void browsersCannotReadOrWritePrivateMatches(String role, String sql) throws SQLException {
        try (Connection connection = asRole(role);
                var statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.execute(sql))
                    .isInstanceOfSatisfying(
                            SQLException.class, e -> assertThat(e.getSQLState()).isEqualTo("42501"));
        }
    }

    static Stream<Arguments> browserOperations() {
        return Stream.of("anon", "authenticated")
                .flatMap(role -> Stream.of(
                                "select * from dame_matches",
                                "insert into dame_matches(id) values (gen_random_uuid())",
                                "update dame_matches set status = 'WHITE_WON'",
                                "delete from dame_matches")
                        .map(sql -> Arguments.of(role, sql)));
    }

    @Test
    void rlsStillHidesRowsIfSelectIsAccidentallyGranted() throws SQLException {
        try (Connection connection = DATABASE.connect();
                var statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            insert(connection, "Cherif", "Amadou", START, "IN_PROGRESS", null);
            statement.execute("grant select on dame_matches to authenticated");
            statement.execute("set local role authenticated");
            try (var rows = statement.executeQuery("select * from dame_matches")) {
                assertThat(rows.next()).isFalse();
            }
            connection.rollback();
        }
    }

    private static Connection asRole(String role) throws SQLException {
        Connection connection = DATABASE.connect();
        connection.setAutoCommit(false);
        try (var statement = connection.createStatement()) {
            // Valeurs fixes des tests uniquement, jamais une entrée du joueur.
            statement.execute("set local role " + role);
        }
        return connection;
    }

    private static void insert(
            Connection connection, String white, String black, Instant start, String status, Instant end)
            throws SQLException {
        try (var statement = connection.prepareStatement("""
                insert into dame_matches(id, white_name, black_name, started_at, status, finished_at)
                values (?, ?, ?, ?, ?, ?)
                """)) {
            statement.setObject(1, ID);
            statement.setString(2, white);
            statement.setString(3, black);
            statement.setTimestamp(4, start == null ? null : Timestamp.from(start));
            statement.setString(5, status);
            statement.setTimestamp(6, end == null ? null : Timestamp.from(end));
            statement.executeUpdate();
        }
    }
}
