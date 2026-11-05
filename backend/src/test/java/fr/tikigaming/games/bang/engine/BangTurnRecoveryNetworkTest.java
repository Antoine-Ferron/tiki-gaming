package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.when;

import eu.rekawek.toxiproxy.Proxy;
import eu.rekawek.toxiproxy.ToxiproxyClient;
import eu.rekawek.toxiproxy.model.ToxicDirection;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.auth.SupabaseAuthClient;
import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.Testcontainers;
import org.testcontainers.toxiproxy.ToxiproxyContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Seule la frontière d'identité distante est doublée ; Spring, sessions, CSRF et moteur sont réels. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.config.import=",
            "server.address=127.0.0.1",
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters",
            "COOKIE_SECURE=false"
        })
@Import(BangTurnRecoveryNetworkTest.Setup.class)
@org.testcontainers.junit.jupiter.Testcontainers(disabledWithoutDocker = true)
class BangTurnRecoveryNetworkTest {
    private static final String TABLES = "/api/games/bang/tables";

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private ObjectMapper json;

    @MockitoBean
    private SupabaseAuthClient identityProvider;

    private ToxiproxyContainer network;
    private final List<Player> players = new ArrayList<>();

    @TestConfiguration
    static class Setup {
        @Bean
        @Primary
        InitialDeal orderedDeal(GameCatalog catalog) {
            return new InitialDeal(catalog, items -> {});
        }
    }

    @AfterEach
    void closeConnections() {
        if (network != null) network.stop();
        players.forEach(player -> player.client.close());
    }

    @Test
    @Timeout(120)
    void aLostEndTurnResponseRecoversTheSameHandAndCannotAdvanceTwice() throws Exception {
        Testcontainers.exposeHostPorts(port);
        network = new ToxiproxyContainer("ghcr.io/shopify/toxiproxy:2.12.0");
        network.start();
        assertThat(network.isRunning())
                .as("Le scénario doit tourner dans Docker")
                .isTrue();
        Proxy proxy = new ToxiproxyClient(network.getHost(), network.getControlPort())
                .createProxy("bang-player", "0.0.0.0:8666", "host.testcontainers.internal:" + port);
        String proxied = "http://" + network.getHost() + ":" + network.getMappedPort(8666);
        String direct = "http://127.0.0.1:" + port;
        for (int seat = 1; seat <= 4; seat++) {
            String email = "recovery-" + seat + "@example.test";
            when(identityProvider.signInWithPassword(email, "test-password"))
                    .thenReturn(new AuthUser("recovery-" + seat, email));
            Player player = new Player(seat == 1 ? proxied : direct);
            players.add(player);
            player.get("/api/auth/session");
            assertThat(player.post(
                                    "/api/auth/login",
                                    json.writeValueAsString(
                                            java.util.Map.of("email", email, "password", "test-password")))
                            .statusCode())
                    .isEqualTo(204);
            player.get("/api/auth/session");
        }
        assertThat(players.stream().map(player -> player.cookie("JSESSIONID")).toList())
                .doesNotHaveDuplicates();
        Player sheriff = players.getFirst();
        String code =
                json.readTree(sheriff.post(TABLES, "{}").body()).path("code").asString();
        String table = TABLES + "/" + code;
        for (Player player : players.subList(1, 4)) {
            assertThat(player.post(table + "/join", "{}").statusCode()).isEqualTo(200);
        }
        assertThat(sheriff.post(table + "/start", "{}").statusCode()).isEqualTo(200);
        assertThat(sheriff.post(table + "/turn/draw", "{}").statusCode()).isEqualTo(204);
        JsonNode playing = sheriff.get(table + "/state");
        assertThat(playing.path("seat").asInt()).isEqualTo(1);
        assertThat(playing.path("role").asString()).isEqualTo("SHERIFF");
        assertThat(playing.at("/players/0/health").asInt()).isEqualTo(5);
        assertThat(playing.path("hand").size()).isEqualTo(7);
        assertThat(playing.path("phase").asString()).isEqualTo("PLAY");
        assertThat(sheriff.client
                        .send(
                                sheriff.request(table + "/turn/end")
                                        .POST(HttpRequest.BodyPublishers.ofString("{}"))
                                        .build(),
                                HttpResponse.BodyHandlers.ofString())
                        .statusCode())
                .as("Le vrai filtre CSRF refuse une commande sans jeton")
                .isEqualTo(403);
        assertThat(sheriff.get(table + "/state")).isEqualTo(playing);

        // Le flux montant reste ouvert ; aucun octet de l'acquittement ne revient au joueur.
        proxy.toxics().timeout("lost-response", ToxicDirection.DOWNSTREAM, 0);
        var lostResponse = sheriff.client.sendAsync(
                sheriff.postRequest(table + "/turn/end", "{}"), HttpResponse.BodyHandlers.ofString());
        Player observer = players.get(1);
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            JsonNode observed = observer.get(table + "/state");
            assertThat(observed.path("phase").asString()).isEqualTo("DISCARD");
            assertThat(observed.path("currentSeat").asInt()).isEqualTo(1);
            assertThat(observed.at("/players/0/handCount").asInt()).isEqualTo(7);
        });
        assertThat(lostResponse).isNotDone();
        proxy.disable();
        assertThatThrownBy(() -> lostResponse.get(5, TimeUnit.SECONDS)).hasRootCauseInstanceOf(IOException.class);
        proxy.toxics().getAll().forEach(toxic -> {
            try {
                toxic.remove();
            } catch (IOException failure) {
                throw new java.io.UncheckedIOException(failure);
            }
        });
        proxy.enable();

        assertThat(json.readTree(sheriff.post(table + "/join", "{}").body())
                        .path("seat")
                        .asInt())
                .isEqualTo(1);
        JsonNode recovered = sheriff.get(table + "/state");
        assertThat(recovered.path("seat")).isEqualTo(playing.path("seat"));
        assertThat(recovered.path("hand")).isEqualTo(playing.path("hand"));
        assertThat(recovered.path("phase").asString()).isEqualTo("DISCARD");
        List<JsonNode> beforeRetry = views(table);
        assertThat(sheriff.post(table + "/turn/end", "{}").statusCode()).isEqualTo(409);
        assertThat(views(table)).isEqualTo(beforeRetry);

        for (int index = 0; index < 2; index++) {
            String card = recovered.path("hand").get(index).path("id").asString();
            assertThat(sheriff.post(table + "/turn/discard/" + card, "{}").statusCode())
                    .isEqualTo(204);
        }
        assertThat(sheriff.get(table + "/state").path("hand").size()).isEqualTo(5);
        assertThat(sheriff.post(table + "/turn/end", "{}").statusCode()).isEqualTo(204);
        for (JsonNode view : views(table)) {
            assertThat(view.path("currentSeat").asInt()).isEqualTo(2);
            assertThat(view.path("phase").asString()).isEqualTo("DRAW");
        }
    }

    private List<JsonNode> views(String table) throws Exception {
        List<JsonNode> views = new ArrayList<>();
        for (Player player : players) views.add(player.get(table + "/state"));
        return views;
    }

    private final class Player {
        private final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        private final HttpClient client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .cookieHandler(cookies)
                .build();
        private final String base;

        private Player(String base) {
            this.base = base;
        }

        private String cookie(String name) {
            return cookies.getCookieStore().getCookies().stream()
                    .filter(cookie -> cookie.getName().equals(name))
                    .findFirst()
                    .orElseThrow()
                    .getValue();
        }

        private HttpRequest.Builder request(String path) {
            return HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(15));
        }

        private HttpRequest postRequest(String path, String body) {
            return request(path)
                    .header("Content-Type", "application/json")
                    .header("X-XSRF-TOKEN", cookie("XSRF-TOKEN"))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
        }

        private HttpResponse<String> post(String path, String body) throws Exception {
            return client.send(postRequest(path, body), HttpResponse.BodyHandlers.ofString());
        }

        private JsonNode get(String path) throws Exception {
            HttpResponse<String> response =
                    client.send(request(path).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            return json.readTree(response.body());
        }
    }
}
