package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import java.util.Map;
import org.junit.jupiter.api.Test;

class TreasuryTest {

    // Fake (registre en mémoire) + mock (passerelle d'audit, sans journal réel).
    private final InMemoryTreasuryRegistry registry = new InMemoryTreasuryRegistry(Map.of("alice", 29, "bob", 1));
    private final AuditNotifier audit = mock(AuditNotifier.class);
    private final Treasury treasury = new Treasury(registry, audit);

    @Test
    void notifiesOnceThePlayerWhoCrossesTheCriticalThreshold() {
        treasury.credit("alice", 1);
        treasury.credit("alice", 3);

        verify(audit).treasuryThresholdCrossed(new TreasuryAlert("alice", 30, Treasury.ALERT_THRESHOLD));
        verifyNoMoreInteractions(audit);
    }

    @Test
    void transfersCoinsBetweenPlayers() {
        treasury.transfer("alice", "bob", 4);

        assertThat(treasury.balanceOf("alice")).isEqualTo(25);
        assertThat(treasury.balanceOf("bob")).isEqualTo(5);
    }

    @Test
    void refusesAnUnpayableOrNonPositiveAmount() {
        assertThatThrownBy(() -> treasury.debit("bob", 2)).hasMessage("Pas assez de pièces");
        assertThatThrownBy(() -> treasury.credit("bob", 0)).hasMessage("Le montant doit être un entier positif");
        assertThat(registry.balanceOf("bob")).isEqualTo(1);
    }

    @Test
    void refusesToDebitAZeroOrNegativeAmount() {
        // Étant donné "alice" qui a 29 pièces (fake : registre en mémoire)
        // Quand on lui débite 0 pièce, ou un montant négatif (qui la créditerait en douce)
        // Alors c'est refusé, et son trésor ne bouge pas
        assertThatThrownBy(() -> treasury.debit("alice", 0)).hasMessage("Le montant doit être un entier positif");
        assertThatThrownBy(() -> treasury.debit("alice", -5)).hasMessage("Le montant doit être un entier positif");
        assertThat(registry.balanceOf("alice")).isEqualTo(29);
    }
}
