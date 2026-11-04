package fr.tikigaming.games.bang.engine;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.cards.Role;
import fr.tikigaming.games.bang.cards.RoleCard;
import fr.tikigaming.games.bang.model.GameState;
import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class PlayerDistanceTest {
    @ParameterizedTest
    @CsvSource({
        "1, 2, 1", "1, 3, 2", "1, 4, 1",
        "2, 1, 1", "2, 3, 1", "2, 4, 2",
        "3, 1, 2", "3, 2, 1", "3, 4, 1",
        "4, 1, 1", "4, 2, 2", "4, 3, 1"
    })
    void takesTheShortestPathBetweenFourLivingSeats(int fromSeat, int toSeat, int expected) {
        GameState state = table(4, 4);

        assertThat(PlayerDistance.between(state, fromSeat, toSeat)).isEqualTo(expected);

        assertThat(state).isEqualTo(table(4, 4));
    }

    @ParameterizedTest
    @CsvSource({"1, 4, 2", "0, 4, 1", "-1, 4, 1", "0, 0, 1", "0, -1, 1"})
    void countsOnlySeatsWithPositiveCurrentHealth(int secondHealth, int fourthHealth, int expected) {
        GameState state = table(secondHealth, fourthHealth);

        assertThat(PlayerDistance.between(state, 1, 3)).isEqualTo(expected);
        assertThat(PlayerDistance.between(state, 3, 1)).isEqualTo(expected);

        assertThat(state).isEqualTo(table(secondHealth, fourthHealth));
    }

    private static GameState table(int secondHealth, int fourthHealth) {
        return new GameState(
                List.of(player(1, 4), player(2, secondHealth), player(3, 4), player(4, fourthHealth)),
                List.of(),
                List.of(),
                1,
                GameState.Phase.PLAY);
    }

    private static GameState.Player player(int seat, int health) {
        return new GameState.Player(
                "account-" + seat,
                seat,
                new RoleCard(Role.OUTLAW, false),
                BangCharacter.BART_CASSIDY,
                health,
                4,
                List.of());
    }
}
