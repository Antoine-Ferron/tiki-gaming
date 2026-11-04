package fr.tikigaming.games.dame.matches;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/** Tests de résultat avec un fake fonctionnel ; moteur et objets métier réels. */
class MatchServiceTest {

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000018");
    private static final UUID OTHER_ID = UUID.fromString("00000000-0000-0000-0000-000000000019");
    private static final Instant START = Instant.parse("2026-11-04T12:00:00Z");
    private static final Instant END = START.plusSeconds(600);

    private final InMemoryMatchRepository repository = new InMemoryMatchRepository();
    private final MatchService service = serviceAt(START);

    private MatchService serviceAt(Instant at) {
        return new MatchService(repository, Clock.fixed(at, ZoneOffset.UTC), () -> ID);
    }

    @Test
    void createsAndReadsTheSameNormalizedMatch() {
        Match created = service.start(" Cherif ", " Amadou ");

        assertThat(created).isEqualTo(Match.start(ID, "Cherif", "Amadou", START));
        assertThat(service.find(ID)).isEqualTo(created);
        assertThat(repository.findById(ID)).contains(created);
    }

    @Test
    void successiveCreationsUseDifferentSuppliedIdentifiers() {
        var ids = List.of(ID, OTHER_ID).iterator();
        MatchService multiple = new MatchService(repository, Clock.fixed(START, ZoneOffset.UTC), ids::next);

        Match first = multiple.start("Cherif", "Amadou");
        Match second = multiple.start("Élodie", "Alex");

        assertThat(first).isNotNull();
        assertThat(second).isNotNull();
        assertThat(first.id()).isEqualTo(ID);
        assertThat(second.id()).isEqualTo(OTHER_ID);
        assertThat(multiple.find(ID)).isEqualTo(first);
        assertThat(multiple.find(OTHER_ID)).isEqualTo(second);
    }

    @Test
    void reportsAnUnknownMatch() {
        assertThatThrownBy(() -> service.find(OTHER_ID))
                .isInstanceOf(NoSuchElementException.class)
                .hasMessage("Rencontre introuvable.");
    }

    @ParameterizedTest
    @EnumSource(Player.class)
    void recordsTheWinnerComputedByTheRealEngine(Player winner) {
        service.start("Cherif", "Amadou");
        Game game = wonGame(winner);

        Match finished = serviceAt(END).finish(ID, game);

        assertThat(finished).isNotNull();
        assertThat(finished.winner()).contains(winner);
        assertThat(finished.status()).isEqualTo(game.status());
        assertThat(finished.startedAt()).isEqualTo(START);
        assertThat(finished.finishedAt()).isEqualTo(END);
        assertThat(finished.whiteName()).isEqualTo("Cherif");
        assertThat(finished.blackName()).isEqualTo("Amadou");
        assertThat(service.find(ID)).isEqualTo(finished);
    }

    @Test
    void recordsAVictoryAfterTheLastOpponentPieceIsCaptured() {
        service.start("Cherif", "Amadou");
        Game game = new Game(
                new Board(Map.of(
                        new Position(6, 1), new Piece(Player.WHITE, false),
                        new Position(5, 2), new Piece(Player.BLACK, false))),
                Player.WHITE);
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
        game.play(new Move(new Position(6, 1), List.of(new Position(4, 3))));

        Match finished = serviceAt(END).finish(ID, game);

        assertThat(finished).isNotNull();
        assertThat(finished.winner()).contains(Player.WHITE);
        assertThat(repository.findById(ID)).contains(finished);
    }

    @Test
    void refusingAnUnfinishedGameKeepsTheStoredMatchUnchanged() {
        Match initial = service.start("Cherif", "Amadou");

        assertThatThrownBy(() -> serviceAt(END).finish(ID, new Game())).isInstanceOf(IllegalArgumentException.class);
        assertThat(repository.findById(ID)).contains(initial);
    }

    @Test
    void cannotFinishAnUnknownMatch() {
        assertThatThrownBy(() -> serviceAt(END).finish(OTHER_ID, wonGame(Player.WHITE)))
                .isInstanceOf(NoSuchElementException.class)
                .hasMessage("Rencontre introuvable.");
        assertThat(repository.findById(OTHER_ID)).isEmpty();
    }

    @Test
    void cannotReplaceTheResultAlreadyStored() {
        service.start("Cherif", "Amadou");
        Match finished = serviceAt(END).finish(ID, wonGame(Player.WHITE));

        assertThatThrownBy(() -> serviceAt(END.plusSeconds(1)).finish(ID, wonGame(Player.BLACK)))
                .isInstanceOf(IllegalStateException.class);
        assertThat(repository.findById(ID)).contains(finished);
    }

    @Test
    void aClockGoingBackwardsCannotSaveAnInvalidResult() {
        Match initial = service.start("Cherif", "Amadou");

        assertThatThrownBy(() -> serviceAt(START.minusNanos(1)).finish(ID, wonGame(Player.WHITE)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(repository.findById(ID)).contains(initial);
    }

    @Test
    void finishingOneMatchDoesNotChangeAnotherMatch() {
        repository.save(Match.start(ID, "Cherif", "Amadou", START));
        Match other = Match.start(OTHER_ID, "Élodie", "Alex", START);
        repository.save(other);

        Match finished = serviceAt(END).finish(ID, wonGame(Player.WHITE));

        assertThat(finished).isNotNull();
        assertThat(finished.status()).isEqualTo(GameStatus.WHITE_WON);
        assertThat(repository.findById(OTHER_ID)).contains(other);
    }

    private static Game wonGame(Player winner) {
        Player next = winner == Player.WHITE ? Player.BLACK : Player.WHITE;
        return new Game(new Board(Map.of(new Position(4, 5), new Piece(winner, false))), next);
    }
}
