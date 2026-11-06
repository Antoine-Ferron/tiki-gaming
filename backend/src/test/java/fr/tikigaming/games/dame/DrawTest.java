package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.game;
import static fr.tikigaming.games.dame.DameTestSupport.king;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** FMJD, annexe 1, article 6 : les positions comprennent le joueur au trait. */
class DrawTest {
    private Game kings() {
        return game(Player.WHITE, at(0, 1, king(Player.WHITE)), at(0, 7, king(Player.BLACK)));
    }

    private void cycle(Game game) {
        game.play(move(0, 1, 1, 0));
        game.play(move(0, 7, 1, 8));
        game.play(move(1, 0, 0, 1));
        game.play(move(1, 8, 0, 7));
    }

    @Test
    void thirdOccurrenceEndsTheGameButSecondDoesNot() {
        Game game = kings();
        cycle(game);
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
        cycle(game);
        assertThat(game.status().name()).isEqualTo("DRAW");
        assertThatThrownBy(() -> game.play(move(0, 1, 1, 0))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resetAfterADrawRestoresTheInitialGame() {
        Game game = kings();
        cycle(game);
        cycle(game);
        assertThat(game.status().name()).isEqualTo("DRAW");
        game.reset();
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(game.board().pieces()).hasSize(40);
        game.play(move(6, 1, 5, 0));
        assertThat(game.currentPlayer()).isEqualTo(Player.BLACK);
    }
}
