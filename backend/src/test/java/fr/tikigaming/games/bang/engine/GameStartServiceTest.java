package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import fr.tikigaming.games.bang.model.GameState;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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

    @Test
    void repeatedRequestsKeepTheFirstDistributionWithoutCallingTheDealerAgain() {
        String code = tableWith(4);
        GameState first = new GameState(List.of(), List.of("remaining-card"), 3);
        GameState unwanted = new GameState(List.of(), List.of(), 1);
        when(deal.deal(anyList())).thenReturn(first, unwanted);

        assertThat(tables.start(code, "player-2")).isSameAs(first);
        assertThat(tables.start(code, "player-4")).isSameAs(first);
        assertThat(tables.game(code)).isSameAs(first);
        verify(deal).deal(List.of("player-1", "player-2", "player-3", "player-4"));
    }

    @Test
    void simultaneousRequestsObtainOneAndTheSameDistribution() throws Exception {
        String code = tableWith(4);
        when(deal.deal(anyList())).thenAnswer(invocation -> new GameState(List.of(), List.of("remaining-card"), 3));
        int contenders = 8;
        CyclicBarrier start = new CyclicBarrier(contenders);
        List<Future<GameState>> requests = new ArrayList<>();

        try (var executor = Executors.newFixedThreadPool(contenders)) {
            for (int request = 0; request < contenders; request++) {
                String account = "player-" + (request % 4 + 1);
                requests.add(executor.submit(() -> {
                    start.await(5, TimeUnit.SECONDS);
                    return tables.start(code, account);
                }));
            }
            GameState first = requests.getFirst().get(5, TimeUnit.SECONDS);
            for (Future<GameState> request : requests) {
                assertThat(request.get(5, TimeUnit.SECONDS)).isSameAs(first);
            }
            assertThat(tables.game(code)).isSameAs(first);
        }
        verify(deal).deal(List.of("player-1", "player-2", "player-3", "player-4"));
    }

    private String tableWith(int players) {
        String code = tables.create("player-1").code();
        for (int player = 2; player <= players; player++) {
            tables.join(code, "player-" + player);
        }
        return code;
    }
}
