package fr.tikigaming.games.sdv_civilisation.api;

import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.JSON;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.saved;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.fail;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import fr.tikigaming.config.TikiProperties;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.support.HttpRequestWrapper;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.web.client.RestClient;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.Container.ExecResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.MountableFile;

/**
 * Intégration contre une vraie base : la même image PostgreSQL que la production (supabase/postgres), les
 * migrations du dépôt rejouées sur base vide, et un vrai PostgREST devant elle, comme l'API REST de Supabase.
 * {@link SupabaseGames} est le vrai adaptateur, avec son vrai client HTTP et son vrai chiffrement : seule la
 * passerelle de Supabase (qui retire le préfixe /rest/v1) est imitée par le test. Aucune donnée ni URL de production.
 *
 * <p>Classe {@code *IT} : ignorée par {@code mvn test}, lancée par le job CI « Integration (Testcontainers) ».
 */
class SdvCivilisationTestcontainersIT {

    private static final String POSTGRES = "supabase/postgres:17.11.0.018";
    private static final String POSTGREST = "postgrest/postgrest:v16.5";
    private static final String PASSWORD = "postgres";
    // Secret de test, propre à ce conteneur (32 caractères minimum, comme celui de quality/docker-compose.yml).
    private static final String JWT_SECRET = "sdv-civilisation-it-jwt-secret-0123456789";
    private static final Path MIGRATIONS = Path.of("..", "supabase", "migrations");
    // Mot de passe du rôle authenticator et auth.uid() de la production : la même mise en place que pour k6.
    private static final Path SETUP = Path.of("..", "quality", "db-init", "99999999999999_quality-setup.sql");
    private static final String ALICE = "6f1c0d2e-0000-4000-8000-0000000000a1";
    private static final String BOB = "6f1c0d2e-0000-4000-8000-0000000000b2";

    private static Network network;
    private static GenericContainer<?> db;
    private static GenericContainer<?> rest;
    private static SupabaseGames games;

    @BeforeAll
    static void startTheDatabaseAndPostgrest() throws Exception {
        if (!DockerClientFactory.instance().isDockerAvailable()) {
            // En CI, l'absence de Docker est une erreur ; en local, le test est ignoré (comme globalSetup.ts).
            if (System.getenv("CI") != null) fail("Docker est requis pour les tests d'intégration");
            assumeTrue(false, "Docker indisponible : test d'intégration ignoré");
        }
        network = Network.newNetwork();
        db = new GenericContainer<>(POSTGRES)
                .withNetwork(network)
                .withNetworkAliases("db")
                .withEnv("POSTGRES_PASSWORD", PASSWORD)
                // Hérité par les commandes psql lancées dans le conteneur.
                .withEnv("PGPASSWORD", PASSWORD)
                // Exécuté par l'image à son initialisation, comme dans quality/docker-compose.yml.
                .withCopyFileToContainer(
                        MountableFile.forHostPath(SETUP),
                        "/docker-entrypoint-initdb.d/migrations/" + SETUP.getFileName())
                .withCopyFileToContainer(MountableFile.forHostPath(MIGRATIONS), "/repo-migrations")
                // Pendant son initialisation, l'image n'écoute que sur le socket local : le port TCP répond une fois
                // prête.
                .waitingFor(Wait.forSuccessfulCommand("pg_isready -U postgres -h 127.0.0.1"))
                .withStartupTimeout(Duration.ofMinutes(3));
        db.start();
        applyMigrations();

        rest = new GenericContainer<>(POSTGREST)
                .withNetwork(network)
                .withEnv("PGRST_DB_URI", "postgres://authenticator:" + PASSWORD + "@db:5432/postgres")
                .withEnv("PGRST_DB_SCHEMAS", "public")
                .withEnv("PGRST_DB_ANON_ROLE", "anon")
                .withEnv("PGRST_JWT_SECRET", JWT_SECRET)
                .withExposedPorts(3000)
                .waitingFor(Wait.forHttp("/").forStatusCode(200));
        rest.start();

        String url = "http://" + rest.getHost() + ":" + rest.getMappedPort(3000);
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(url, "anon-key", serviceRoleToken(), JWT_SECRET, Duration.ofHours(1)));
        games = new SupabaseGames(
                SdvCivilisationConfig.supabase(withoutRestPrefix(RestClient.builder()), props),
                new SealedState(props, JSON));
        sql("insert into auth.users (id, email, raw_user_meta_data) values"
                + " ('" + ALICE + "', 'alice@test.local', '{\"username\": \"alice\"}'),"
                + " ('" + BOB + "', 'bob@test.local', '{\"username\": \"bob\"}')");
    }

    @AfterAll
    static void stopTheContainers() {
        if (rest != null) rest.stop();
        if (db != null) db.stop();
        if (network != null) network.close();
    }

    @BeforeEach
    void noGameSavedYet() throws Exception {
        // Chaque test part d'une table vide : aucun ne dépend d'un autre.
        sql("delete from public.game_saves");
    }

    /** Rejoue les migrations du dépôt, dans l'ordre, chacune dans sa transaction (comme scripts/migrations.mjs). */
    private static void applyMigrations() throws IOException, InterruptedException {
        List<String> files;
        try (Stream<Path> listing = Files.list(MIGRATIONS)) {
            files = listing.map(p -> p.getFileName().toString())
                    .filter(name -> name.endsWith(".sql"))
                    .sorted()
                    .toList();
        }
        for (String file : files) {
            ExecResult result = db.execInContainer(
                    "psql",
                    "-v",
                    "ON_ERROR_STOP=1",
                    "--single-transaction",
                    "-U",
                    "postgres",
                    "-h",
                    "127.0.0.1",
                    "-d",
                    "postgres",
                    "-f",
                    "/repo-migrations/" + file);
            if (result.getExitCode() != 0) throw new IllegalStateException(file + " : " + result.getStderr());
        }
    }

    private static String sql(String query) throws IOException, InterruptedException {
        ExecResult result = db.execInContainer(
                "psql",
                "-v",
                "ON_ERROR_STOP=1",
                "-U",
                "postgres",
                "-h",
                "127.0.0.1",
                "-d",
                "postgres",
                "-tA",
                "-c",
                query);
        if (result.getExitCode() != 0) throw new IllegalStateException(result.getStderr());
        return result.getStdout().trim();
    }

    /** Clé service de test : un JWT au rôle service_role, signé avec le secret de ce PostgREST. */
    private static String serviceRoleToken() {
        Instant now = Instant.now();
        NimbusJwtEncoder encoder = new NimbusJwtEncoder(
                new ImmutableSecret<>(new SecretKeySpec(JWT_SECRET.getBytes(UTF_8), "HmacSHA256")));
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .claim("role", "service_role")
                .issuedAt(now)
                .expiresAt(now.plus(Duration.ofHours(1)))
                .build();
        return encoder.encode(JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    /** Imite la passerelle de Supabase : /rest/v1/game_saves est servi par PostgREST à la racine (/game_saves). */
    private static RestClient.Builder withoutRestPrefix(RestClient.Builder builder) {
        return builder.requestInterceptor((request, body, execution) -> execution.execute(
                new HttpRequestWrapper(request) {
                    @Override
                    public URI getURI() {
                        URI uri = request.getURI();
                        return URI.create(uri.toString().replaceFirst("/rest/v1/", "/"));
                    }
                },
                body));
    }

    private static String rawData(String userId) throws IOException, InterruptedException {
        return sql("select data::text from public.game_saves where user_id = '" + userId
                + "' and game_slug = 'sdv-civilisation'");
    }

    @Test
    void aSavedGameIsReadBackIdenticallyAndStoredSealed() throws Exception {
        // Étant donné "alice" qui commence une partie
        GameStore store = games.forUser(ALICE);

        // Quand le serveur l'enregistre, puis la relit
        store.save(saved(1), 0);

        // Alors il retrouve exactement la même partie
        assertThat(store.load()).contains(saved(1));
        // Et en base, la colonne data ne contient que la version et le sceau : aucune carte ni main des IA en clair
        String data = rawData(ALICE);
        assertThat(JSON.readTree(data).propertyNames()).containsExactlyInAnyOrder("version", "sealed");
        assertThat(data).doesNotContain("IA 1", "Citadelle", "hands", "Chantier");
    }

    @Test
    void theOptimisticLockOfPostgrestRefusesAnOutdatedVersion() throws Exception {
        // Étant donné une partie enregistrée en version 1
        GameStore store = games.forUser(ALICE);
        store.save(saved(1), 0);

        // Quand le serveur enregistre le tour 2 en attendant la version 1
        store.save(saved(2), 1);

        // Alors la ligne passe en version 2
        assertThat(store.load()).contains(saved(2));
        // Et un second envoi qui attend encore la version 1 (autre onglet) est refusé par le filtre data->>version
        assertThatThrownBy(() -> store.save(saved(3), 1)).isInstanceOf(StaleGameException.class);
        assertThat(JSON.readTree(rawData(ALICE)).get("version").asInt()).isEqualTo(2);
    }

    @Test
    void twoPlayersNeverSeeEachOthersGame() throws Exception {
        // Étant donné "alice" qui a une partie en cours, et "bob" qui n'en a pas
        games.forUser(ALICE).save(saved(1), 0);

        // Quand "bob" cherche sa partie, puis en commence une et l'abandonne
        // Alors il ne voit jamais celle d'alice, qui reste intacte
        assertThat(games.forUser(BOB).load()).isEmpty();
        games.forUser(BOB).save(saved(4), 0);
        assertThat(games.forUser(BOB).load()).contains(saved(4));
        games.forUser(BOB).clear();
        assertThat(games.forUser(BOB).load()).isEmpty();
        assertThat(games.forUser(ALICE).load()).contains(saved(1));
    }
}
