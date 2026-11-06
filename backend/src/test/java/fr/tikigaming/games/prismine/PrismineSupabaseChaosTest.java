package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;

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
import java.time.Instant;
import java.util.UUID;
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
 * Chaos — Toxiproxy (dans Docker) s'intercale entre Prismine et un faux PostgREST, puis injecte des pannes réseau :
 * le timeout abandonne l'appel lent, le disjoncteur répond ensuite tout de suite, puis se referme au retour de
 * Supabase.
 *
 * <p>Ignoré sans Docker ; toujours exécuté en CI.
 */
@org.testcontainers.junit.jupiter.Testcontainers(disabledWithoutDocker = true)
class PrismineSupabaseChaosTest {

    private static final Duration READ_TIMEOUT = Duration.ofMillis(500);
    private static final Duration LATENCY = Duration.ofMillis(1_200);
    private static final Duration OPEN_DURATION = Duration.ofMillis(800);
    private static final int THRESHOLD = 3;

    private static final AtomicInteger RECEIVED = new AtomicInteger();
    private static HttpServer fakePostgrest;
    private static ToxiproxyContainer toxiproxy;
    private static Proxy proxy;

    private CircuitBreaker breaker;
    private SupabaseRunRepository runs;

    @BeforeAll
    static void startTheNetwork() throws IOException {
        fakePostgrest = HttpServer.create(new InetSocketAddress(0), 0);
        fakePostgrest.createContext("/rest/v1/prismine_runs", exchange -> {
            RECEIVED.incrementAndGet();
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(201, -1);
            exchange.close();
        });
        fakePostgrest.start();
        int port = fakePostgrest.getAddress().getPort();
        Testcontainers.exposeHostPorts(port);

        toxiproxy = new ToxiproxyContainer("ghcr.io/shopify/toxiproxy:2.12.0");
        toxiproxy.start();
        ToxiproxyClient api = new ToxiproxyClient(toxiproxy.getHost(), toxiproxy.getControlPort());
        proxy = api.createProxy("prismine-supabase", "0.0.0.0:8666", "host.testcontainers.internal:" + port);
    }

    @AfterAll
    static void stopTheNetwork() {
        if (toxiproxy != null) toxiproxy.stop();
        if (fakePostgrest != null) fakePostgrest.stop(0);
    }

    @BeforeEach
    void setUp() {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(HttpClient.newHttpClient());
        factory.setReadTimeout(READ_TIMEOUT); // en application : spring.http.clients.read-timeout
        String url = "http://" + toxiproxy.getHost() + ":" + toxiproxy.getMappedPort(8666);
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(url, "anon", "service", "jwt-secret", Duration.ofHours(1)));
        breaker = new CircuitBreaker(THRESHOLD, OPEN_DURATION, Clock.systemUTC(), PrismineSupabase::isOutage);
        runs = new SupabaseRunRepository(
                new PrismineSupabase(RestClient.builder().requestFactory(factory), props, breaker),
                JsonMapper.builder().build());
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
        runs.insert(Expedition.start(UUID.randomUUID(), "joueur-1", 42, Instant.parse("2026-11-06T10:00:00Z")));
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
    void aSlowSupabaseIsAbandonedAtTheTimeoutThenTheCircuitAnswersAtOnce() throws IOException {
        proxy.toxics().latency("lent", ToxicDirection.DOWNSTREAM, LATENCY.toMillis());

        for (int i = 0; i < THRESHOLD; i++) {
            assertThat(timed(this::insert)).isBetween(READ_TIMEOUT, LATENCY);
        }
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);

        assertThat(timed(this::insert)).isLessThan(Duration.ofMillis(100));
        assertThat(statusOf(this::insert)).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void aCutConnectionOpensTheCircuitAndItClosesWhenSupabaseIsBack() throws Exception {
        proxy.disable();

        for (int i = 0; i < THRESHOLD; i++) {
            assertThat(statusOf(this::insert)).isEqualTo(HttpStatus.BAD_GATEWAY);
        }
        assertThat(statusOf(this::insert)).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(RECEIVED).hasValue(0);

        proxy.enable();
        Thread.sleep(OPEN_DURATION.toMillis());

        assertThat(statusOf(this::insert)).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        assertThat(RECEIVED).hasValue(1);
    }
}
