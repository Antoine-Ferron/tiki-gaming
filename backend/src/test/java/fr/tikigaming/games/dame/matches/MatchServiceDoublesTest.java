package fr.tikigaming.games.dame.matches;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Distingue les entrées préparées (stubs) et les interactions vérifiées (mocks). */
class MatchServiceDoublesTest {

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000018");
    private static final Instant START = Instant.parse("2026-11-04T12:00:00Z");
    private static final Instant END = START.plusSeconds(600);

    private MatchService service(MatchRepository repository) {
        return new MatchService(repository, Clock.fixed(END, ZoneOffset.UTC), () -> ID);
    }

    @Test
    void aHandwrittenStubProvidesAPreparedMatch() {
        Match prepared = Match.start(ID, "Cherif", "Amadou", START);
        MatchRepository stub = new MatchRepository() {
            @Override
            public Optional<Match> findById(UUID id) {
                return Optional.of(prepared);
            }

            @Override
            public void save(Match match) {
                throw new UnsupportedOperationException("Ce stub ne prend en charge que la lecture.");
            }
        };

        assertThat(service(stub).find(ID)).isEqualTo(prepared);
    }

    @Test
    void aMockitoStubSimulatesAReadFailure() {
        MatchRepository stub = mock(MatchRepository.class);
        RuntimeException outage = new IllegalStateException("Stockage indisponible");
        when(stub.findById(ID)).thenThrow(outage);

        assertThatThrownBy(() -> service(stub).find(ID)).isSameAs(outage);
    }

    @Test
    void aWriteFailureIsPropagatedWhenStarting() {
        RuntimeException outage = new IllegalStateException("Stockage indisponible");
        MatchRepository stub = failingWriter(Optional.empty(), outage);

        assertThatThrownBy(() -> service(stub).start("Cherif", "Amadou")).isSameAs(outage);
    }

    @Test
    void aWriteFailureIsPropagatedWhenFinishingWithoutChangingTheOriginal() {
        Match prepared = Match.start(ID, "Cherif", "Amadou", START);
        RuntimeException outage = new IllegalStateException("Stockage indisponible");
        MatchRepository stub = failingWriter(Optional.of(prepared), outage);

        assertThatThrownBy(() -> service(stub).finish(ID, wonGame())).isSameAs(outage);
        assertThat(prepared.status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(prepared.finishedAt()).isNull();
    }

    @ParameterizedTest
    @CsvSource(value = {"'',Amadou", "Cherif,''", "'   ',Amadou", "Cherif,'   '"})
    void invalidNamesNeverReachTheRepository(String whiteName, String blackName) {
        MatchRepository repository = mock(MatchRepository.class);

        assertThatThrownBy(() -> service(repository).start(whiteName, blackName))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(repository);
    }

    @Test
    void anUnfinishedGameNeverTriggersAWriting() {
        MatchRepository repository = mock(MatchRepository.class);
        when(repository.findById(ID)).thenReturn(Optional.of(Match.start(ID, "Cherif", "Amadou", START)));

        assertThatThrownBy(() -> service(repository).finish(ID, new Game()))
                .isInstanceOf(IllegalArgumentException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void anAlreadyFinishedMatchNeverTriggersAWriting() {
        MatchRepository repository = mock(MatchRepository.class);
        Match finished = new Match(ID, "Cherif", "Amadou", START, GameStatus.WHITE_WON, END);
        when(repository.findById(ID)).thenReturn(Optional.of(finished));

        assertThatThrownBy(() -> service(repository).finish(ID, wonGame())).isInstanceOf(IllegalStateException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void theExactResultIsWrittenOnce() {
        MatchRepository repository = mock(MatchRepository.class);
        when(repository.findById(ID)).thenReturn(Optional.of(Match.start(ID, "Cherif", "Amadou", START)));
        Match expected = new Match(ID, "Cherif", "Amadou", START, GameStatus.WHITE_WON, END);

        Match result = service(repository).finish(ID, wonGame());

        assertThat(result).isEqualTo(expected);
        verify(repository).findById(ID);
        verify(repository).save(expected);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void aMissingIdentifierIsRejectedBeforeAccessingStorage() {
        MatchRepository repository = mock(MatchRepository.class);

        assertThatThrownBy(() -> service(repository).find(null)).isInstanceOf(NullPointerException.class);

        verifyNoInteractions(repository);
    }

    @Test
    void aMissingGameIsRejectedBeforeAccessingStorage() {
        MatchRepository repository = mock(MatchRepository.class);

        assertThatThrownBy(() -> service(repository).finish(ID, null)).isInstanceOf(NullPointerException.class);

        verifyNoInteractions(repository);
    }

    private static MatchRepository failingWriter(Optional<Match> prepared, RuntimeException outage) {
        return new MatchRepository() {
            @Override
            public Optional<Match> findById(UUID id) {
                return prepared;
            }

            @Override
            public void save(Match match) {
                throw outage;
            }
        };
    }

    private static Game wonGame() {
        return new Game(new Board(Map.of(new Position(4, 5), new Piece(Player.WHITE, false))), Player.BLACK);
    }
}
