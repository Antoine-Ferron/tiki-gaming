package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.util.Map;
import org.junit.jupiter.api.Test;

class TradeTest {

    // Stub (taux figé à 5) + fake (registre en mémoire).
    private final InMemoryTreasuryRegistry registry = new InMemoryTreasuryRegistry(Map.of("alice", 12));
    private final Trade trade = new Trade(new FixedRateConverter(5), new Treasury(registry, mock(AuditNotifier.class)));

    @Test
    void buyerPaysTheSellerThePriceGivenByTheConverter() {
        int price = trade.buy(new Purchase("alice", "bob", Resource.WOOD, 2));

        assertThat(price).isEqualTo(10);
        assertThat(registry.balanceOf("alice")).isEqualTo(2);
        assertThat(registry.balanceOf("bob")).isEqualTo(10);
    }

    @Test
    void refusesAnEmptyPurchaseOrBuyingFromOneself() {
        assertThatThrownBy(() -> trade.buy(new Purchase("alice", "bob", Resource.WOOD, 0)))
                .hasMessage("On achète au moins une ressource");
        assertThatThrownBy(() -> trade.buy(new Purchase("alice", "alice", Resource.WOOD, 1)))
                .hasMessage("On achète à un voisin, pas à soi-même");
    }
}
