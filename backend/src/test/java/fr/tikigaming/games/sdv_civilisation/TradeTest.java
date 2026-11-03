package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TradeTest {

    private InMemoryTreasuryRegistry registry;

    private Treasury treasury(Map<String, Integer> balances) {
        registry = new InMemoryTreasuryRegistry(balances);
        return new Treasury(registry, mock(AuditNotifier.class));
    }

    @Test
    void buyerPaysTheSellerThePriceGivenByTheConverter() {
        // Taux figé à 5 : le prix vient bien du convertisseur, pas d'un tarif codé en dur.
        Trade trade = new Trade(new FixedRateConverter(5), treasury(Map.of("alice", 12, "bob", 0)));

        int price = trade.buy(new Purchase("alice", "bob", Resource.WOOD, 2));

        assertThat(price).isEqualTo(10);
        assertThat(registry.balanceOf("alice")).isEqualTo(2);
        assertThat(registry.balanceOf("bob")).isEqualTo(10);
    }

    @Test
    void asksTheConverterForThePurchasedResourceAndQuantity() {
        CurrencyConverter converter = mock(CurrencyConverter.class);
        when(converter.toCoins(Resource.GLASS, 3)).thenReturn(6);
        Trade trade = new Trade(converter, treasury(Map.of("alice", 10, "bob", 0)));

        trade.buy(new Purchase("alice", "bob", Resource.GLASS, 3));

        verify(converter).toCoins(Resource.GLASS, 3);
    }

    @Test
    void refusesAnUnpayablePurchaseWithoutChangingAnyTreasury() {
        Trade trade = new Trade(new FixedRateConverter(2), treasury(Map.of("alice", 3, "bob", 0)));

        assertThatThrownBy(() -> trade.buy(new Purchase("alice", "bob", Resource.ORE, 2)))
                .hasMessage("Pas assez de pièces");
        assertThat(registry.balanceOf("alice")).isEqualTo(3);
        assertThat(registry.balanceOf("bob")).isZero();
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    void refusesANonPositiveQuantity(int quantity) {
        Trade trade = new Trade(new FixedRateConverter(2), treasury(Map.of("alice", 10, "bob", 0)));

        assertThatThrownBy(() -> trade.buy(new Purchase("alice", "bob", Resource.CLAY, quantity)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("On achète au moins une ressource");
    }

    @Test
    void refusesToBuyFromOneself() {
        Trade trade = new Trade(new FixedRateConverter(2), treasury(Map.of("alice", 10)));

        assertThatThrownBy(() -> trade.buy(new Purchase("alice", "alice", Resource.STONE, 1)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("On achète à un voisin, pas à soi-même");
    }
}
