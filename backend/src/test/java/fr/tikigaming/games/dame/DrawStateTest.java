package fr.tikigaming.games.dame;

import static fr.tikigaming.games.dame.DameTestSupport.at;
import static fr.tikigaming.games.dame.DameTestSupport.board;
import static fr.tikigaming.games.dame.DameTestSupport.king;
import static fr.tikigaming.games.dame.DameTestSupport.man;
import static fr.tikigaming.games.dame.DameTestSupport.move;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class DrawStateTest {
    private final Board kings = board(at(0, 1, king(Player.WHITE)), at(0, 7, king(Player.BLACK)));

    @ParameterizedTest
    @CsvSource({
        "48,-1,-1,IN_PROGRESS",
        "49,-1,-1,DRAW",
        "0,2,-1,IN_PROGRESS",
        "0,1,-1,DRAW",
        "0,-1,2,IN_PROGRESS",
        "0,-1,1,DRAW"
    })
    void restoredCountersEndExactlyAtTheBoundary(int quiet, int sixteen, int five, GameStatus expected) {
        Game game = new Game(kings, Player.WHITE, new DrawState(Map.of(), quiet, sixteen, five));
        game.play(move(0, 1, 1, 0));
        assertThat(game.status()).isEqualTo(expected);
        assertThat(game.drawState().quietPlies()).isEqualTo(quiet + 1);
    }

    @Test
    void movementOfAManResetsTheTwentyFiveMoveCounterAndRepetitions() {
        Board position = board(at(6, 1, man(Player.WHITE)), at(0, 7, king(Player.BLACK)));
        Game game = new Game(
                position,
                Player.WHITE,
                new DrawState(DrawState.initial(position, Player.WHITE).repetitions(), 49, -1, -1));
        game.play(move(6, 1, 5, 0));
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(game.drawState().quietPlies()).isZero();
        assertThat(game.drawState().repetitions()).hasSize(1);
    }

    @Test
    void captureResetsQuietMovesButDoesNotRestartTheSixteenMoveDeadline() {
        Board position = board(at(6, 1, king(Player.WHITE)), at(5, 2, man(Player.BLACK)), at(0, 7, king(Player.BLACK)));
        Game game = new Game(position, Player.WHITE, new DrawState(Map.of(), 49, 7, -1));
        game.play(move(6, 1, 4, 3));
        assertThat(game.drawState().quietPlies()).isZero();
        assertThat(game.drawState().sixteenRemaining()).isEqualTo(6);
        assertThat(game.drawState().fiveRemaining()).isEqualTo(10);
    }

    @Test
    void victoryOnTheLastAllowedMoveTakesPrecedenceOverADraw() {
        Board position = board(at(6, 1, king(Player.WHITE)), at(5, 2, king(Player.BLACK)));
        Game game = new Game(position, Player.WHITE, new DrawState(Map.of(), 49, 1, 1));
        game.play(move(6, 1, 4, 3));
        assertThat(game.status()).isEqualTo(GameStatus.WHITE_WON);
    }

    @Test
    void identicalBoardsWithADifferentPlayerToMoveDoNotRepeat() {
        DrawState white = DrawState.initial(kings, Player.WHITE);
        DrawState black = DrawState.initial(kings, Player.BLACK);
        assertThat(white.repetitions().keySet())
                .doesNotContainAnyElementsOf(black.repetitions().keySet());
    }

    @Test
    void refusedMoveDoesNotAdvanceAnyCounter() {
        Game game = new Game(kings, Player.WHITE);
        DrawState initial = game.drawState();
        assertThatThrownBy(() -> game.play(move(0, 1, 0, 3))).isInstanceOf(IllegalArgumentException.class);
        assertThat(game.drawState()).isEqualTo(initial);
    }

    @ParameterizedTest
    @CsvSource({
        "1,0,10,-1",
        "2,0,10,-1",
        "1,1,10,-1",
        "3,0,-1,32",
        "2,1,-1,32",
        "1,2,-1,32",
        "0,2,-1,-1",
        "0,3,-1,-1",
        "4,0,-1,-1"
    })
    void specialEndingsRequireALoneOpposingKingAndAtLeastOneFriendlyKing(
            int kingCount, int manCount, int five, int sixteen) {
        var pieces = new java.util.HashMap<Position, Piece>();
        pieces.put(new Position(0, 7), king(Player.BLACK));
        for (int i = 0; i < kingCount + manCount; i++) {
            pieces.put(new Position(8, 1 + i * 2), new Piece(Player.WHITE, i < kingCount));
        }
        DrawState state = DrawState.initial(new Board(pieces), Player.WHITE);
        assertThat(state.fiveRemaining()).isEqualTo(five);
        assertThat(state.sixteenRemaining()).isEqualTo(sixteen);
    }

    @Test
    void boardWithoutALoneKingDoesNotStartSpecialCounters() {
        DrawState state = DrawState.initial(Board.initial(), Player.WHITE);
        assertThat(state.fiveRemaining()).isEqualTo(-1);
        assertThat(state.sixteenRemaining()).isEqualTo(-1);
    }

    @Test
    void repetitionDistinguishesOwnershipPromotionAndEveryOccupiedSquare() {
        Board original = board(at(6, 1, king(Player.WHITE)), at(0, 7, king(Player.BLACK)));
        Board otherSquare = board(at(7, 0, king(Player.WHITE)), at(0, 7, king(Player.BLACK)));
        Board unpromoted = board(at(6, 1, man(Player.WHITE)), at(0, 7, king(Player.BLACK)));
        Board swapped = board(at(6, 1, king(Player.BLACK)), at(0, 7, king(Player.WHITE)));
        var originalKey =
                DrawState.initial(original, Player.WHITE).repetitions().keySet();
        for (Board different : java.util.List.of(otherSquare, unpromoted, swapped)) {
            assertThat(DrawState.initial(different, Player.WHITE).repetitions().keySet())
                    .isNotEqualTo(originalKey);
        }
    }

    @Test
    void aLoneOpposingManDoesNotStartAKingEndgameDeadline() {
        Board position = board(
                at(0, 7, man(Player.BLACK)),
                at(8, 1, king(Player.WHITE)),
                at(8, 3, king(Player.WHITE)),
                at(8, 5, king(Player.WHITE)));
        DrawState state = DrawState.initial(position, Player.WHITE);
        assertThat(state.sixteenRemaining()).isEqualTo(-1);
        assertThat(state.fiveRemaining()).isEqualTo(-1);
    }

    @ParameterizedTest
    @CsvSource({"-1,-1,-1", "51,-1,-1", "0,-2,-1", "0,33,-1", "0,-1,-2", "0,-1,11"})
    void rejectsCorruptedPersistedCounters(int quiet, int sixteen, int five) {
        assertThatThrownBy(() -> new DrawState(Map.of(), quiet, sixteen, five))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsCorruptedPositionsAndOccurrencesInPersistedHistory() {
        String key = DrawState.initial(kings, Player.WHITE)
                .repetitions()
                .keySet()
                .iterator()
                .next();
        assertThatThrownBy(() -> new DrawState(Map.of("damaged", 1), 0, -1, -1))
                .isInstanceOf(IllegalArgumentException.class);
        for (int count : new int[] {0, 4}) {
            assertThatThrownBy(() -> new DrawState(Map.of(key, count), 0, -1, -1))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
