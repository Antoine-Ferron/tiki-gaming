package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.prismine.Expedition.Verdict;
import fr.tikigaming.games.prismine.TestDoubles.InMemoryRunRepository;
import fr.tikigaming.games.prismine.TestDoubles.InMemoryScoreRegistry;
import fr.tikigaming.games.prismine.TestDoubles.MutableClock;
import fr.tikigaming.games.prismine.TestDoubles.StubSeedSource;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * TU — service de Prismine, isolé de tout I/O par ses contrats (un test par étape de l'atelier) :
 *
 * <ol>
 *   <li>bouchon {@link StubSeedSource} et faux {@link InMemoryRunRepository} ;
 *   <li>faux {@link InMemoryScoreRegistry} : le registre des scores, sans Supabase ;
 *   <li>simulacre {@link AuditNotifier} (Mockito) : appel unique au franchissement du seuil ;
 *   <li>faux {@link MutableClock} : le temps avance à la demande, sans attente réelle.
 * </ol>
 */
class PrismineServiceTest {

    private static final Instant T0 = Instant.parse("2026-11-03T10:00:00Z");
    private static final String PLAYER = "joueur-1";

    private final MutableClock clock = new MutableClock(T0);
    private final InMemoryRunRepository runs = new InMemoryRunRepository(clock);
    private final InMemoryScoreRegistry scores = new InMemoryScoreRegistry();
    private final AuditNotifier audit = mock(AuditNotifier.class);
    private final PrismineService service =
            new PrismineService(runs, scores, audit, new StubSeedSource(42, 7, 9), clock);

    /** Valide la carte juste de l'étage en cours, régénérée depuis sa graine figée. */
    private Verdict.Cleared clear(Run run, String userId) {
        String solution = Floors.generate(run.depth(), run.seed()).grid();
        return (Verdict.Cleared) service.validate(run.id(), userId, solution);
    }

    @Test
    void stubbedSeedsAndInMemoryRegistryKeepOneSafeLiveRunPerPlayer() {
        Run run = service.start(PLAYER);
        assertThat(run.seed()).isEqualTo(42);
        assertThat(runs.find(run.id())).contains(run);

        clock.advance(Duration.ofMinutes(1));
        assertThat(clear(run, PLAYER).next().seed()).isEqualTo(7);
        assertThat(runs.find(run.id()).orElseThrow().depth()).isEqualTo(2);

        // Une écriture faite sur une version déjà remplacée (requête concurrente) est refusée.
        assertThatThrownBy(() -> runs.update(run.nextVersion()))
                .isInstanceOf(ApiException.class)
                .extracting("status")
                .isEqualTo(HttpStatus.CONFLICT);

        // Une seule expédition en cours : par compte, ou par session d'invité.
        Run next = service.start(PLAYER);
        assertThat(runs.find(run.id())).isEmpty();
        Run guest = service.start(null);
        assertThat(runs.find(service.start(null, guest.id()).id())).isPresent();
        assertThat(runs.find(guest.id())).isEmpty();
        assertThat(runs.find(next.id())).isPresent();
        // Expédition commencée en invité puis connexion dans la même session : elle est abandonnée aussi.
        Run beforeLogin = service.start(null);
        service.start(PLAYER, beforeLogin.id());
        assertThat(runs.find(beforeLogin.id())).isEmpty();
    }

    @Test
    void recordsTheScoreWithItsDurationForAPlayerButNotForAGuest() {
        Run run = service.start(PLAYER);
        clock.advance(Duration.ofSeconds(30));
        clear(run, PLAYER);
        clock.advance(Duration.ofSeconds(90));
        assertThat(service.finish(run.id(), PLAYER).recorded()).isTrue();
        assertThat(scores.recorded())
                .containsExactly(new InMemoryScoreRegistry.Recorded(
                        PLAYER, 150, Map.of("depth", 2, "probes", 0, "errors", 0, "durationSeconds", 120L)));
        assertThat(runs.find(run.id())).isEmpty();

        Run guest = service.start(null);
        clock.advance(Duration.ofSeconds(30));
        clear(guest, null);
        assertThat(service.finish(guest.id(), null).recorded()).isFalse();
        assertThat(scores.recorded()).hasSize(1);

        // Lampe éteinte puis panne au classement : l'expédition est figée avec sa dernière erreur, une seule fois ;
        // la nouvelle tentative (fin d'expédition) ne recompte rien et classe le score une seule fois.
        Run unlucky = service.start(PLAYER);
        clock.advance(Duration.ofSeconds(30));
        Run depth2 = clear(unlucky, PLAYER).next();
        runs.update(depth2.withOil(0).nextVersion());
        scores.failNext();
        String empty = Engine.emptyGrid(PrismineService.floorOf(depth2).spec().size());
        assertThatThrownBy(() -> service.validate(unlucky.id(), PLAYER, empty)).isInstanceOf(ApiException.class);
        assertThat(runs.find(unlucky.id()).orElseThrow())
                .extracting(Run::over, Run::totalErrors)
                .containsExactly(true, 1);
        assertThatThrownBy(() -> service.validate(unlucky.id(), PLAYER, empty)).hasMessage(PrismineService.RUN_OVER);
        assertThat(service.finish(unlucky.id(), PLAYER).run().totalErrors()).isEqualTo(1);
        assertThat(scores.recorded()).hasSize(2);
    }

    @Test
    void auditsAnExpeditionOnlyOnceWhenFloorsAreClearedTooFast() {
        Run human = service.start(PLAYER);
        clock.advance(Duration.ofSeconds(30));
        clear(human, PLAYER);
        verifyNoInteractions(audit);

        Run bot = service.start(PLAYER);
        clock.advance(Duration.ofSeconds(2));
        Run second = clear(bot, PLAYER).next();
        clock.advance(Duration.ofSeconds(1));
        clear(second, PLAYER);
        // Deux étages trop rapides, un seul signalement.
        verify(audit).floorTooFast(bot.id(), PLAYER, 1, Duration.ofSeconds(2));
        verify(audit).floorTooFast(any(), any(), anyInt(), any());
    }

    @Test
    void clockDrivesTheAuditThresholdAndTheRunPurgeWithoutSleeping() {
        Run atThreshold = service.start(PLAYER);
        clock.advance(Expedition.MIN_FLOOR_DURATION);
        clear(atThreshold, PLAYER);
        verify(audit, never()).floorTooFast(any(), any(), anyInt(), any());

        Run below = service.start(PLAYER);
        clock.advance(Expedition.MIN_FLOOR_DURATION.minusMillis(1));
        clear(below, PLAYER);
        verify(audit).floorTooFast(below.id(), PLAYER, 1, Duration.ofMillis(4999));

        // Purge : une expédition inactive depuis exactement 24 h est gardée, 1 ms de plus et elle est supprimée.
        clock.advance(PrismineService.INACTIVE_RUN_TTL);
        service.purgeInactiveRuns();
        assertThat(runs.find(below.id())).isPresent();
        clock.advance(Duration.ofMillis(1));
        service.purgeInactiveRuns();
        assertThat(runs.find(below.id())).isEmpty();
    }
}
