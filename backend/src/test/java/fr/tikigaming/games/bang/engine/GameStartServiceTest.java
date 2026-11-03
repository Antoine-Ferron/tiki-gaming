package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import fr.tikigaming.games.bang.model.GameState;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class GameStartServiceTest {
    private final InitialDeal deal = mock(InitialDeal.class);
    private final PrivateTableService tables = new PrivateTableService(deal);

    @Test
    void startingRequestsADealForTheAccountsInSeatOrder() {
        String code = tableWith(4);
        GameState game = new GameState(List.of(), List.of(), 3);
        when(deal.deal(List.of("player-1", "player-2", "player-3", "player-4"))).thenReturn(game);

        assertThat(tables.start(code, "player-3")).isSameAs(game);

        assertThat(tables.game(code)).isSameAs(game);
        verify(deal).deal(List.of("player-1", "player-2", "player-3", "player-4"));
        verifyNoMoreInteractions(deal);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3})
    void incompleteTablesDoNotRequestAnyDistribution(int players) {
        String code = tableWith(players);

        assertThatThrownBy(() -> tables.start(code, "player-1"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        verifyNoInteractions(deal);
        assertThat(tables.game(code)).isNull();
    }

    @Test
    void anOutsiderCannotRequestAnyDistribution() {
        String code = tableWith(4);

        assertThatThrownBy(() -> tables.start(code, "outsider"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        verifyNoInteractions(deal);
        assertThat(tables.game(code)).isNull();
    }

    private String tableWith(int players) {
        String code = tables.create("player-1").code();
        for (int player = 2; player <= players; player++) {
            tables.join(code, "player-" + player);
        }
        return code;
    }
}
