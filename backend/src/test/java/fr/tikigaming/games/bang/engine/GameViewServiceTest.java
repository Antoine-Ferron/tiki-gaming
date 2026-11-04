package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.CardType;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.cards.RoleCard;
import fr.tikigaming.games.bang.model.CardInstance;
import fr.tikigaming.games.bang.model.GameState;
import fr.tikigaming.games.bang.model.PlayerGameView;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;

class GameViewServiceTest {
    private final InitialDeal deal = mock(InitialDeal.class);
    private final PrivateTableService tables = new PrivateTableService(deal);

    @Test
    void readingProjectsOnlyTheConnectedPlayersSecretsAndPublicFields() {
        List<String> accounts = List.of("one", "two", "three", "four");
        String code = tables.create("one").code();
        accounts.subList(1, 4).forEach(account -> tables.join(code, account));
        GameState game = new GameState(
                List.of(
                        player("one", 1, Role.SHERIFF, true, BangCharacter.BART_CASSIDY, 3, 5, "sheriff-card"),
                        player("two", 2, Role.OUTLAW, false, BangCharacter.CALAMITY_JANET, 2, 4, "own-card"),
                        player("three", 3, Role.OUTLAW, false, BangCharacter.PAUL_REGRET, 1, 3, "other-card"),
                        player("four", 4, Role.RENEGADE, false, BangCharacter.WILLY_THE_KID, 4, 4, "renegade-card")),
                List.of(new CardInstance("secret-deck-card", CardType.MISSED)),
                List.of(),
                3,
                GameState.Phase.PLAY);
        when(deal.deal(accounts)).thenReturn(game);
        tables.start(code, "one");

        assertThat(tables.state(code, "two"))
                .isEqualTo(new PlayerGameView(
                        code,
                        2,
                        3,
                        GameState.Phase.PLAY,
                        Role.OUTLAW,
                        List.of(new PlayerGameView.Card("own-card", CardType.BANG)),
                        List.of(
                                new PlayerGameView.Player(
                                        1, BangCharacter.BART_CASSIDY, 3, 5, List.of(), 1, Role.SHERIFF),
                                new PlayerGameView.Player(2, BangCharacter.CALAMITY_JANET, 2, 4, List.of(), 1, null),
                                new PlayerGameView.Player(3, BangCharacter.PAUL_REGRET, 1, 3, List.of(), 1, null),
                                new PlayerGameView.Player(4, BangCharacter.WILLY_THE_KID, 4, 4, List.of(), 1, null))));
        assertThat(tables.game(code)).isSameAs(game);
        verify(deal).deal(accounts);
        verifyNoMoreInteractions(deal);
    }

    @Test
    void readingUsesTheCanonicalCode() {
        List<String> accounts = List.of("one", "two", "three", "four");
        String code = tables.create("one").code();
        accounts.subList(1, 4).forEach(account -> tables.join(code, account));
        when(deal.deal(accounts))
                .thenReturn(new GameState(
                        List.of(player("one", 1, Role.SHERIFF, true, BangCharacter.BART_CASSIDY, 3, 5, "card")),
                        List.of(),
                        List.of(),
                        1,
                        GameState.Phase.DRAW));
        tables.start(code, "one");

        assertThat(tables.state("  " + code.toLowerCase(Locale.ROOT) + "  ", "one"))
                .isEqualTo(tables.state(code, "one"));
    }

    private static GameState.Player player(
            String account,
            int seat,
            Role role,
            boolean faceUp,
            BangCharacter character,
            int health,
            int maxHealth,
            String cardId) {
        return new GameState.Player(
                account,
                seat,
                new RoleCard(role, faceUp),
                character,
                health,
                maxHealth,
                List.of(new CardInstance(cardId, CardType.BANG)));
    }
}
