package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.List;
import org.junit.jupiter.api.Test;

class AdaptersTest {

    @Test
    void productionAdapters() {
        long before = System.currentTimeMillis();

        assertThat(new StandardTrade().toCoins(Resource.PAPYRUS, 3)).isEqualTo(6);
        assertThat(new SystemClock().now()).isBetween(before, System.currentTimeMillis());
        assertThatCode(() -> new LogAuditNotifier().treasuryThresholdCrossed(new TreasuryAlert("alice", 30, 30)))
                .doesNotThrowAnyException();
        assertThatCode(() -> new LogAuditNotifier().inactivityDetected(new InactivityReport("alice", 61_000)))
                .doesNotThrowAnyException();
    }

    @Test
    void theRandomShufflerKeepsEveryCardAndLeavesTheDeckUntouched() {
        // Étant donné un paquet de l'âge I
        List<Card> deck = Cards.ofAge(1);

        // Quand on le mélange au hasard
        List<Card> shuffled = new RandomShuffler().shuffle(deck);

        // Alors on retrouve les mêmes cartes (l'ordre, lui, n'est pas vérifié : il est aléatoire)
        assertThat(shuffled).containsExactlyInAnyOrderElementsOf(deck);
        assertThat(deck).isEqualTo(Cards.ofAge(1));
    }
}
