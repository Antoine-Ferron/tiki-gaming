package fr.tikigaming.games.dame.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import eu.rekawek.toxiproxy.Proxy;
import eu.rekawek.toxiproxy.ToxiproxyClient;
import eu.rekawek.toxiproxy.model.ToxicDirection;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.matches.GameSave;
import fr.tikigaming.games.dame.matches.Match;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.testcontainers.Testcontainers;
import org.testcontainers.toxiproxy.ToxiproxyContainer;
import tools.jackson.databind.json.JsonMapper;

/** Vrai PostgREST et PostgreSQL : la panne affecte le réseau, aucun serveur simulé. */
class DameStorageChaosIT {
    private static final DameDatabase DATABASE = new DameDatabase();
    private static ToxiproxyContainer container;
    private static Proxy proxy;
    private static SupabaseMatchRepository repository;
    private static SupabaseGameSaveRepository saves;

    @BeforeAll
    static void start() throws Exception {
        DATABASE.start();
        int port = URI.create(DATABASE.restUrl()).getPort();
        Testcontainers.exposeHostPorts(port);
        container = new ToxiproxyContainer("ghcr.io/shopify/toxiproxy:2.12.0");
        container.start();
        proxy = new ToxiproxyClient(container.getHost(), container.getControlPort())
                .createProxy("dame", "0.0.0.0:8666", "host.testcontainers.internal:" + port);
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build());
        factory.setReadTimeout(Duration.ofMillis(400));
        RestClient rest = RestClient.builder()
                .baseUrl("http://" + container.getHost() + ":" + container.getMappedPort(8666))
                .defaultHeader("Authorization", "Bearer " + DATABASE.serviceToken())
                .requestFactory(factory)
                .build();
        repository = new SupabaseMatchRepository(rest, JsonMapper.builder().build());
        saves = new SupabaseGameSaveRepository(rest, JsonMapper.builder().build());
    }

    @AfterEach
    void heal() throws Exception {
        for (var toxic : proxy.toxics().getAll()) toxic.remove();
        proxy.enable();
    }

    @AfterAll
    static void stop() {
        if (container != null) container.close();
        DATABASE.close();
    }

    private Match create() {
        Match match = Match.start(UUID.randomUUID(), "Chérif", "Amadou", Instant.parse("2026-11-06T10:00:00Z"));
        repository.save(match);
        return match;
    }

    @Test
    void cutBeforeWritePreservesResultAndRecoversWithoutRestart() throws Exception {
        Match initial = create();
        Match finished =
                initial.finish(GameStatus.WHITE_WON, initial.startedAt().plusSeconds(1));
        proxy.disable();
        assertThatThrownBy(() -> repository.save(finished)).isInstanceOf(MatchStorageException.class);
        proxy.enable();
        assertThat(repository.findById(initial.id())).contains(initial);
        repository.save(finished);
        assertThat(repository.findById(initial.id())).contains(finished);
    }

    @Test
    void slowReadTimesOutAndThenRecovers() throws Exception {
        Match initial = create();
        proxy.toxics().latency("slow", ToxicDirection.DOWNSTREAM, 3000);
        long start = System.nanoTime();
        assertThatThrownBy(() -> repository.findById(initial.id())).isInstanceOf(MatchStorageException.class);
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(3));
        proxy.toxics().get("slow").remove();
        assertThat(repository.findById(initial.id())).contains(initial);
    }

    @Test
    void lostWriteResponseCanBeReconciledByReadingAndCannotCloseTwice() throws Exception {
        Match initial = create();
        Match finished =
                initial.finish(GameStatus.BLACK_WON, initial.startedAt().plusSeconds(1));
        proxy.toxics().latency("lost-reply", ToxicDirection.DOWNSTREAM, 3000);
        assertThatThrownBy(() -> repository.save(finished)).isInstanceOf(MatchStorageException.class);
        proxy.toxics().get("lost-reply").remove();
        assertThat(repository.findById(initial.id())).contains(finished);
        assertThatThrownBy(() -> repository.save(finished)).isInstanceOf(IllegalStateException.class);
        assertThat(repository.findById(initial.id())).contains(finished);
    }

    @Test
    void durableBoardSurvivesCutAndLostReplyWithoutApplyingTheMoveTwice() throws Exception {
        Match match = Match.start(UUID.randomUUID(), "A", "B", Instant.parse("2026-11-06T10:00:00Z"));
        String owner = "c".repeat(64);
        saves.save(new GameSave(match, owner, 0, "{\"view\":{\"version\":0},\"history\":{}}"));
        GameSave next = new GameSave(match, owner, 1, "{\"view\":{\"version\":1},\"history\":{}}");
        proxy.disable();
        assertThatThrownBy(() -> saves.save(next)).isInstanceOf(MatchStorageException.class);
        proxy.enable();
        assertThat(saves.findOwned(match.id(), owner).orElseThrow().version()).isZero();
        proxy.toxics().latency("lost-board-reply", ToxicDirection.DOWNSTREAM, 3000);
        assertThatThrownBy(() -> saves.save(next)).isInstanceOf(MatchStorageException.class);
        proxy.toxics().get("lost-board-reply").remove();
        assertThat(saves.findOwned(match.id(), owner).orElseThrow().version()).isEqualTo(1);
        assertThatThrownBy(() -> saves.save(next)).isInstanceOf(IllegalStateException.class);
    }
}
