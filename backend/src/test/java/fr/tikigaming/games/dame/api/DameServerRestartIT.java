package fr.tikigaming.games.dame.api;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.dame.demo.DameLocalDemo;
import fr.tikigaming.games.dame.persistence.DameDatabase;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.context.ConfigurableApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Deux vrais serveurs Spring successifs, vrai HTTP et même PostgreSQL conservé. */
class DameServerRestartIT {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void restartingJavaAndLosingTheSessionCookiePreservesTheBoard() throws Exception {
        try (DameDatabase database = new DameDatabase()) {
            database.start();
            CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
            HttpClient browser = HttpClient.newBuilder()
                    .cookieHandler(cookies)
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();
            String id;
            String recovery;
            JsonNode played;
            try (var first = DameLocalDemo.startApplication(database, 0)) {
                String root = root(first);
                assertThat(browser.send(
                                        HttpRequest.newBuilder(URI.create(root + "/api/auth/session"))
                                                .GET()
                                                .build(),
                                        HttpResponse.BodyHandlers.ofString())
                                .statusCode())
                        .isEqualTo(200);
                String csrf = cookies.getCookieStore().getCookies().stream()
                        .filter(cookie -> cookie.getName().equals("XSRF-TOKEN"))
                        .findFirst()
                        .orElseThrow()
                        .getValue();
                var created = post(
                        browser,
                        root + "/api/games/dame/matches",
                        csrf,
                        "{\"whiteName\":\"Chérif\",\"blackName\":\"Amadou\"}");
                assertThat(created.statusCode()).isEqualTo(201);
                id = JSON.readTree(created.body()).path("id").asString();
                var moved = post(
                        browser,
                        root + "/api/games/dame/matches/" + id + "/moves",
                        csrf,
                        "{\"version\":0,\"from\":{\"row\":6,\"column\":1},\"landings\":[{\"row\":5,\"column\":0}]}");
                assertThat(moved.statusCode()).isEqualTo(200);
                played = JSON.readTree(moved.body());
                recovery = cookies.getCookieStore().getCookies().stream()
                        .filter(cookie -> cookie.getName().equals(DameController.COOKIE))
                        .findFirst()
                        .orElseThrow()
                        .getValue();
            }
            // Nouveau serveur, nouveau client ; seul le cookie de reprise persistant est conservé.
            try (var second = DameLocalDemo.startApplication(database, 0)) {
                HttpClient reopened = HttpClient.newHttpClient();
                URI url = URI.create(root(second) + "/api/games/dame/matches/" + id);
                var loaded = reopened.send(
                        HttpRequest.newBuilder(url)
                                .header("Cookie", DameController.COOKIE + "=" + recovery)
                                .GET()
                                .build(),
                        HttpResponse.BodyHandlers.ofString());
                assertThat(loaded.statusCode()).isEqualTo(200);
                assertThat(JSON.readTree(loaded.body())).isEqualTo(played);
                assertThat(reopened.send(
                                        HttpRequest.newBuilder(url).GET().build(), HttpResponse.BodyHandlers.ofString())
                                .statusCode())
                        .isEqualTo(404);
            }
        }
    }

    private static String root(ConfigurableApplicationContext app) {
        return "http://localhost:" + app.getEnvironment().getProperty("local.server.port");
    }

    private static HttpResponse<String> post(HttpClient client, String url, String csrf, String body) throws Exception {
        return client.send(
                HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(10))
                        .header("Content-Type", "application/json")
                        .header("X-XSRF-TOKEN", csrf)
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }
}
