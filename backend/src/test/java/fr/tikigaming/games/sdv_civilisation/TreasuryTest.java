package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.Map;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class TreasuryTest {

    // Mock : enregistre les appels à la passerelle d'audit, sans journal réel.
    private final AuditNotifier audit = mock(AuditNotifier.class);

    private InMemoryTreasuryRegistry registry;

    private Treasury treasury(Map<String, Integer> balances) {
        registry = new InMemoryTreasuryRegistry(balances);
        return new Treasury(registry, audit);
    }

    @Test
    void creditsThePlayer() {
        Treasury treasury = treasury(Map.of("alice", 1));

        treasury.credit("alice", 3);

        assertThat(registry.balanceOf("alice")).isEqualTo(4);
    }

    // solde, montant débité, solde attendu
    @ParameterizedTest
    @CsvSource({"5, 5, 0", "5, 2, 3"})
    void debitsThePlayer(int balance, int amount, int expected) {
        Treasury treasury = treasury(Map.of("alice", balance));

        treasury.debit("alice", amount);

        assertThat(registry.balanceOf("alice")).isEqualTo(expected);
    }

    @Test
    void refusesADebitAboveTheBalanceWithoutDebiting() {
        Treasury treasury = treasury(Map.of("alice", 5));

        assertThatThrownBy(() -> treasury.debit("alice", 6))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Pas assez de pièces");
        assertThat(registry.balanceOf("alice")).isEqualTo(5);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    void refusesANonPositiveAmount(int amount) {
        Treasury treasury = treasury(Map.of("alice", 5));

        assertThatThrownBy(() -> treasury.credit("alice", amount))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Le montant doit être un entier positif");
        assertThatThrownBy(() -> treasury.debit("alice", amount))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Le montant doit être un entier positif");
    }

    @Test
    void transfersCoinsBetweenPlayers() {
        Treasury treasury = treasury(Map.of("alice", 5, "bob", 1));

        treasury.transfer("alice", "bob", 4);

        assertThat(registry.balanceOf("alice")).isEqualTo(1);
        assertThat(registry.balanceOf("bob")).isEqualTo(5);
    }

    @Test
    void refusesAnUnpayableTransferWithoutCreditingTheRecipient() {
        Treasury treasury = treasury(Map.of("alice", 1, "bob", 1));

        assertThatThrownBy(() -> treasury.transfer("alice", "bob", 2)).hasMessage("Pas assez de pièces");
        assertThat(registry.balanceOf("bob")).isEqualTo(1);
    }

    @Nested
    class CriticalThresholdAudit {

        @Test
        void criticalThresholdIsThirtyCoins() {
            assertThat(Treasury.ALERT_THRESHOLD).isEqualTo(30);
        }

        @Test
        void notifiesOnceThePlayerWhoCrossesTheThreshold() {
            Treasury treasury = treasury(Map.of("alice", 29));

            treasury.credit("alice", 1);

            verify(audit, times(1)).treasuryThresholdCrossed(new TreasuryAlert("alice", 30, 30));
        }

        // solde de départ, montant crédité, signalé ?
        @ParameterizedTest
        @CsvSource({"28, 1, false", "29, 1, true", "10, 25, true", "30, 1, false"})
        void notifiesOnlyWhenTheThresholdIsCrossed(int from, int amount, boolean crossed) {
            Treasury treasury = treasury(Map.of("alice", from));

            treasury.credit("alice", amount);

            verify(audit, times(crossed ? 1 : 0))
                    .treasuryThresholdCrossed(new TreasuryAlert("alice", from + amount, 30));
        }

        @Test
        void doesNotNotifyAgainWhileThePlayerStaysAboveTheThreshold() {
            Treasury treasury = treasury(Map.of("alice", 29));

            treasury.credit("alice", 1);
            treasury.credit("alice", 3);
            treasury.debit("alice", 2);

            verify(audit, times(1)).treasuryThresholdCrossed(new TreasuryAlert("alice", 30, 30));
            verify(audit, never()).treasuryThresholdCrossed(new TreasuryAlert("alice", 34, 30));
        }

        @Test
        void notifiesAgainAfterDroppingBelowTheThreshold() {
            Treasury treasury = treasury(Map.of("alice", 29));

            treasury.credit("alice", 1);
            treasury.debit("alice", 5);
            treasury.credit("alice", 5);

            verify(audit, times(2)).treasuryThresholdCrossed(new TreasuryAlert("alice", 30, 30));
        }

        @Test
        void debitsNeverNotify() {
            Treasury treasury = treasury(Map.of("alice", 40));

            treasury.debit("alice", 20);

            verifyNoInteractions(audit);
        }

        @Test
        void notifiesTheRecipientOfATransferThatCrossesTheThreshold() {
            Treasury treasury = treasury(Map.of("alice", 40, "bob", 28));

            treasury.transfer("alice", "bob", 2);

            verify(audit, times(1)).treasuryThresholdCrossed(new TreasuryAlert("bob", 30, 30));
        }
    }
}
