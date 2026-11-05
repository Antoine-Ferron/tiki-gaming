package fr.tikigaming.games.bang.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

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
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
class PrivateTablesCsrfHttpTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private ObjectMapper json;

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/api/games/bang/tables",
                "/api/games/bang/tables/{code}/join",
                "/api/games/bang/tables/{code}/start",
                "/api/games/bang/tables/{code}/shots/{cardId}/targets/{targetSeat}",
                "/api/games/bang/tables/{code}/shots/{shotId}/accept",
                "/api/games/bang/tables/{code}/shots/{shotId}/dodge/{cardId}"
            })
    void swaggerMatchesTheJsonCsrfResponseFromTheEmbeddedServer(String documentedPath) throws Exception {
        String path = documentedPath
                .replace("{code}", "UNKNOWN")
                .replace("{cardId}", "card")
                .replace("{targetSeat}", "2")
                .replace("{shotId}", "shot");
        try (HttpClient client = HttpClient.newHttpClient()) {
            HttpResponse<String> response = client.send(
                    request(path).POST(HttpRequest.BodyPublishers.noBody()).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(403);
            assertThat(response.headers().firstValue("Content-Type").orElse("")).startsWith("application/json");
            JsonNode observed = json.readTree(response.body());
            assertThat(observed.path("timestamp").isString()).isTrue();
            assertThat(observed.path("status").asInt()).isEqualTo(403);
            assertThat(observed.path("error").asString()).isEqualTo("Forbidden");
            assertThat(observed.path("path").asString()).isEqualTo(path);

            HttpResponse<String> documentation =
                    client.send(request("/v3/api-docs").GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(documentation.statusCode()).isEqualTo(200);
            JsonNode openApi = json.readTree(documentation.body());
            JsonNode schema = openApi.path("paths")
                    .path(documentedPath)
                    .path("post")
                    .path("responses")
                    .path("403")
                    .path("content")
                    .path("application/json")
                    .path("schema");
            if (schema.has("anyOf")) {
                JsonNode alternatives = schema.get("anyOf");
                for (int index = 0; index < alternatives.size(); index++) {
                    JsonNode alternative = alternatives.get(index);
                    if (alternative.path("$ref").asString().equals("#/components/schemas/CsrfErrorResponse")) {
                        schema = alternative;
                    }
                }
            }
            if (schema.has("$ref")) {
                schema = openApi.at(schema.get("$ref").asString().substring(1));
            }

            assertThat(schema.isObject())
                    .as("Le 403 OpenAPI de %s doit décrire le JSON observé : %s", documentedPath, response.body())
                    .isTrue();
            for (String field : List.of("timestamp", "status", "error", "path")) {
                String observedType = observed.path(field).isIntegralNumber() ? "integer" : "string";
                assertThat(schema.path("properties").path(field).path("type").asString())
                        .as("Type OpenAPI du champ %s du 403", field)
                        .isEqualTo(observedType);
            }
        }
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(5))
                .header("Accept", "application/json");
    }
}
