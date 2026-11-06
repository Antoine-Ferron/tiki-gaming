package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;

import au.com.dius.pact.provider.junit5.HttpTestTarget;
import au.com.dius.pact.provider.junit5.PactVerificationContext;
import au.com.dius.pact.provider.junit5.PactVerificationInvocationContextProvider;
import au.com.dius.pact.provider.junitsupport.Provider;
import au.com.dius.pact.provider.junitsupport.State;
import au.com.dius.pact.provider.junitsupport.loader.PactFolder;
import fr.tikigaming.games.prismine.TestDoubles.InMemoryRunRepository;
import fr.tikigaming.games.prismine.TestDoubles.InMemoryScoreRegistry;
import fr.tikigaming.games.prismine.TestDoubles.StubSeedSource;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.apache.hc.core5.http.ClassicHttpRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestTemplate;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import tools.jackson.databind.ObjectMapper;

/** Contrat Prismine rejoué sur le vrai serveur HTTP : routes, sécurité, validation et règles réelles, sans Supabase. */
@Provider("tiki-prismine-backend")
@PactFolder("../frontend/pacts")
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://pact-prismine.supabase.invalid",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@Import(PrisminePactProviderTest.Doubles.class)
class PrisminePactProviderTest {

    @TestConfiguration
    static class Doubles {
        @Bean
        @Primary
        RunRepository pactRuns() {
            return new InMemoryRunRepository(Clock.systemUTC());
        }

        @Bean
        @Primary
        ScoreRegistry pactScores() {
            return new InMemoryScoreRegistry();
        }

        @Bean
        @Primary
        SeedSource pactSeeds() {
            return new StubSeedSource(42);
        }
    }

    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private final Map<String, String> cookies = new LinkedHashMap<>();

    @LocalServerPort
    int port;

    @Autowired
    ObjectMapper json;

    @BeforeEach
    void target(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", port));
    }

    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verifiesThePrismineFrontendContract(PactVerificationContext context, ClassicHttpRequest request) {
        request.setHeader("Cookie", cookieHeader());
        if (request.containsHeader("X-XSRF-TOKEN")) request.setHeader("X-XSRF-TOKEN", cookies.get("XSRF-TOKEN"));
        context.verifyInteraction();
    }

    @State("aucune expédition Prismine dans cette session")
    void noRun() throws Exception {
        assertThat(send("/api/auth/session", null).statusCode()).isEqualTo(200);
    }

    @State("une expédition Prismine est en cours")
    Map<String, Object> runInProgress() throws Exception {
        noRun();
        HttpResponse<String> response = send("/api/games/prismine/runs", "{}");
        assertThat(response.statusCode()).isEqualTo(201);
        return Map.of("runId", json.readTree(response.body()).path("id").asString());
    }

    private String cookieHeader() {
        return cookies.entrySet().stream()
                .map(cookie -> cookie.getKey() + "=" + cookie.getValue())
                .collect(Collectors.joining("; "));
    }

    private HttpResponse<String> send(String path, String body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (!cookies.isEmpty()) request.header("Cookie", cookieHeader());
        if (body != null) {
            request.header("Content-Type", "application/json")
                    .header("X-XSRF-TOKEN", cookies.get("XSRF-TOKEN"))
                    .POST(HttpRequest.BodyPublishers.ofString(body));
        }
        HttpResponse<String> response = HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
        for (String header : response.headers().allValues("Set-Cookie")) {
            String[] pair = header.split(";", 2)[0].split("=", 2);
            cookies.put(pair[0], pair[1]);
        }
        return response;
    }
}
