package fr.tikigaming.scores;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import eu.rekawek.toxiproxy.Proxy;
import eu.rekawek.toxiproxy.ToxiproxyClient;
import eu.rekawek.toxiproxy.model.ToxicDirection;
import fr.tikigaming.config.ApiException;
import fr.tikigaming.config.TikiProperties;
import fr.tikigaming.resilience.CircuitBreaker;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.testcontainers.Testcontainers;
import org.testcontainers.toxiproxy.ToxiproxyContainer;
import tools.jackson.databind.json.JsonMapper;

/**
 * Chaos engineering : Toxiproxy (dans Docker) s'intercale entre le client des scores et un faux Supabase, puis
 * injecte des pannes réseau. On vérifie que le timeout abandonne l'appel lent, que le disjoncteur s'ouvre et répond
 * tout de suite (fail-fast) tant que la panne dure, puis se referme quand Supabase revient.
 *
 * <p>Ignoré sans Docker ; toujours exécuté en CI (runner Ubuntu, Docker disponible).
 */
@org.testcontainers.junit.jupiter.Testcontainers(disabledWithoutDocker = true)
class SupabaseScoresChaosTest {

    private static final Duration READ_TIMEOUT = Duration.ofMillis(500);
    private static final Duration LATENCY = Duration.ofMillis(1_200);
    private static final Duration OPEN_DURATION = Duration.ofMillis(800);
    private static final int THRESHOLD = 3;
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static HttpServer fakeSupabase;
    private static final AtomicInteger RECEIVED = new AtomicInteger();
    private static ToxiproxyContainer toxiproxy;
    private static Proxy proxy;

    private CircuitBreaker breaker;
    private SupabaseScoresClient client;

    @BeforeAll
    static void startTheNetwork() throws IOException {
        // Faux PostgREST sur la machine hôte : accepte chaque insertion (201).
        fakeSupabase = HttpServer.create(new InetSocketAddress(0), 0);
        fakeSupabase.createContext("/rest/v1/scores", exchange -> {
            RECEIVED.incrementAndGet();
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(201, -1);
            exchange.close();
        });
        fakeSupabase.start();
        int port = fakeSupabase.getAddress().getPort();
        Testcontainers.exposeHostPorts(port); // le conteneur joint l'hôte via host.testcontainers.internal

        toxiproxy = new ToxiproxyContainer("ghcr.io/shopify/toxiproxy:2.12.0");
        toxiproxy.start();
        ToxiproxyClient api = new ToxiproxyClient(toxiproxy.getHost(), toxiproxy.getControlPort());
        proxy = api.createProxy("supabase", "0.0.0.0:8666", "host.testcontainers.internal:" + port);
    }

    @AfterAll
    static void stopTheNetwork() {
        if (toxiproxy != null) toxiproxy.stop();
        if (fakeSupabase != null) fakeSupabase.stop(0);
    }

    @BeforeEach
    void setUp() {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(HttpClient.newHttpClient());
        factory.setReadTimeout(READ_TIMEOUT); // en application : spring.http.clients.read-timeout
        String url = "http://" + toxiproxy.getHost() + ":" + toxiproxy.getMappedPort(8666);
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(url, "anon", "service", "jwt-secret", Duration.ofHours(1)));
        breaker = new CircuitBreaker(THRESHOLD, OPEN_DURATION, Clock.systemUTC(), SupabaseScoresClient::isOutage);
        client = new SupabaseScoresClient(RestClient.builder().requestFactory(factory), props, JSON, breaker);
        RECEIVED.set(0);
    }

    @AfterEach
    void healTheNetwork() throws IOException {
        for (var toxic : proxy.toxics().getAll()) {
            toxic.remove();
        }
        proxy.enable();
    }

    private void insert() {
        client.insert("u-1", "clicker", 120, JSON.readTree("{}"));
    }

    private static Duration timed(Runnable action) {
        long start = System.nanoTime();
        try {
            action.run();
        } catch (ApiException ignored) {
            // le statut est vérifié par l'appelant
        }
        return Duration.ofNanos(System.nanoTime() - start);
    }

    private static HttpStatus statusOf(Runnable action) {
        try {
            action.run();
            return HttpStatus.NO_CONTENT;
        } catch (ApiException e) {
            return e.status();
        }
    }

    @Test
    void withoutFaultTheScoreGoesThroughTheProxy() {
        insert();

        assertThat(RECEIVED).hasValue(1);
    }

    @Test
    void aSlowSupabaseIsAbandonedAtTheTimeoutThenTheCircuitOpensAndAnswersAtOnce() throws IOException {
        proxy.toxics().latency("lent", ToxicDirection.DOWNSTREAM, LATENCY.toMillis());

        // Chaque appel est abandonné au timeout (≈ 500 ms), bien avant la réponse retardée de 1 200 ms.
        for (int i = 0; i < THRESHOLD; i++) {
            Duration elapsed = timed(this::insert);
            assertThat(elapsed).isBetween(READ_TIMEOUT, LATENCY);
        }
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);

        // Disjoncteur ouvert : 503 immédiat, aucun thread n'attend Supabase.
        assertThat(timed(this::insert)).isLessThan(Duration.ofMillis(100));
        assertThat(statusOf(this::insert)).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void aCutConnectionOpensTheCircuitAndItClosesAgainWhenSupabaseIsBack() throws Exception {
        proxy.disable(); // coupure brutale : connexions refusées

        for (int i = 0; i < THRESHOLD; i++) {
            assertThat(statusOf(this::insert)).isEqualTo(HttpStatus.BAD_GATEWAY);
        }
        assertThat(statusOf(this::insert)).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(RECEIVED).hasValue(0);

        proxy.enable();
        Thread.sleep(OPEN_DURATION.toMillis()); // fin du délai d'ouverture : un appel d'essai passera

        assertThat(statusOf(this::insert)).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        assertThat(RECEIVED).hasValue(1);
    }

    @Test
    void anOutageThatEndsBeforeTheThresholdNeverOpensTheCircuit() throws IOException {
        proxy.disable();
        for (int i = 0; i < THRESHOLD - 1; i++) {
            assertThatThrownBy(this::insert).isInstanceOf(ApiException.class);
        }
        proxy.enable();

        insert();

        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        assertThat(RECEIVED).hasValue(1);
    }
}
