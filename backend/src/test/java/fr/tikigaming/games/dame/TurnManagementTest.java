package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.assertAccepted;
import static fr.tikigaming.games.dame.DameTestSupport.assertRejected;
import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.game;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TurnManagementTest {

    @Test
    void letsWhiteStartANewGame() {
        Game game = new Game();

        assertThat(game.currentPlayer()).isEqualTo(Player.WHITE);
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
    }

    @Test
    void alternatesPlayersAfterEachAcceptedMove() {
        Game game = game(Player.WHITE, at(6, 1, man(Player.WHITE)), at(3, 8, man(Player.BLACK)));

        assertAccepted(game, move(6, 1, 5, 0));
        assertThat(game.currentPlayer()).isEqualTo(Player.BLACK);

        assertAccepted(game, move(3, 8, 4, 9));
        assertThat(game.currentPlayer()).isEqualTo(Player.WHITE);
    }

    @Test
    void rejectsTheOpponentsPieceWithoutChangingTheTurn() {
        Game game = game(Player.WHITE, at(6, 1, man(Player.WHITE)), at(3, 8, man(Player.BLACK)));

        assertRejected(game, move(3, 8, 4, 7));
    }

    @Test
    void doesNotLetTheSamePlayerMoveTwice() {
        Game game = game(Player.WHITE, at(6, 1, man(Player.WHITE)), at(3, 8, man(Player.BLACK)));
        assertAccepted(game, move(6, 1, 5, 0));

        assertRejected(game, move(5, 0, 4, 1));
    }
}
