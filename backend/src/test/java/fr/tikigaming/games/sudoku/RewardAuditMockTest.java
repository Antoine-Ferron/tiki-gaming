package fr.tikigaming.games.sudoku;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatcher;

/**
 * Tests de comportement : la passerelle d'audit est un mock Mockito, donc aucun appel réseau n'est possible.
 * Seuil critique : 100 TIKI de solde. Taux figé : 1 PTS = 0,01 TIKI, donc 10 000 points = 100 TIKI.
 */
class RewardAuditMockTest {

    private static final Instant START = Instant.parse("2026-11-03T10:00:00Z");

    private AuditNotifier gateway;
    private RewardService service;

    @BeforeEach
    void setUp() {
        gateway = mock(AuditNotifier.class);
        service = new RewardService(
                new FixedClock(START), new StubCurrencyConverter("PTS", "TIKI", "0.01"), new InMemoryLedger(), gateway);
    }

    private static ArgumentMatcher<AuditEvent> ofType(String type) {
        return event -> event.type().equals(type);
    }

    @Test
    void callsTheGatewayExactlyOnceWhenTheThresholdIsCrossed() {
        service.reward("p1", 9_000); // 90 TIKI : sous le seuil
        service.reward("p1", 2_000); // 110 TIKI : franchi

        verify(gateway, times(1)).notify(argThat(ofType(RewardService.CRITICAL_THRESHOLD_CROSSED)));
    }

    @Test
    void landingExactlyOnTheThresholdCountsAsCrossing() {
        service.reward("p1", 9_000);
        service.reward("p1", 1_000); // 100 TIKI pile

        verify(gateway, times(1)).notify(argThat(ofType(RewardService.CRITICAL_THRESHOLD_CROSSED)));
    }

    @Test
    void neverCallsTheGatewayForThePlainThresholdEventBelowTheThreshold() {
        service.reward("p1", 5_000);
        service.reward("p1", 4_999); // 99,99 TIKI

        verify(gateway, never()).notify(argThat(ofType(RewardService.CRITICAL_THRESHOLD_CROSSED)));
    }

    @Test
    void doesNotNotifyAgainOnceTheThresholdIsAlreadyBehind() {
        service.reward("p1", 20_000); // franchi d'un coup
        service.reward("p1", 5_000);
        service.reward("p1", 5_000);

        verify(gateway, times(1)).notify(argThat(ofType(RewardService.CRITICAL_THRESHOLD_CROSSED)));
    }

    @Test
    void eachPlayerCrossesTheThresholdOnHisOwn() {
        service.reward("p1", 6_000);
        service.reward("p2", 6_000);
        service.reward("p1", 6_000); // p1 : 120
        service.reward("p2", 6_000); // p2 : 120

        verify(gateway, times(2)).notify(argThat(ofType(RewardService.CRITICAL_THRESHOLD_CROSSED)));
    }

    @Test
    void thresholdEventCarriesPlayerBalanceAndThreshold() {
        service.reward("p1", 9_000);
        service.reward("p1", 2_000);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(gateway, times(3)).notify(captor.capture()); // 2 récompenses + 1 franchissement
        List<AuditEvent> events = captor.getAllValues();
        assertThat(events)
                .extracting(AuditEvent::type)
                .containsExactly(
                        RewardService.REWARD_GRANTED,
                        RewardService.REWARD_GRANTED,
                        RewardService.CRITICAL_THRESHOLD_CROSSED);
        assertThat(events.get(2).details()).isEqualTo(Map.of("player", "p1", "balance", "110.00", "threshold", "100"));
        assertThat(events.get(2).at()).isEqualTo(START);
    }

    @Test
    void rewardEventIsSentBeforeTheThresholdEvent() {
        service.reward("p1", 12_000);

        var order = org.mockito.Mockito.inOrder(gateway);
        order.verify(gateway).notify(argThat(ofType(RewardService.REWARD_GRANTED)));
        order.verify(gateway).notify(argThat(ofType(RewardService.CRITICAL_THRESHOLD_CROSSED)));
    }

    @Test
    void invalidRewardNeverReachesTheGateway() {
        assertThatThrownBy(() -> service.reward("p1", -1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.reward(" ", 100)).isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(gateway);
    }
}
