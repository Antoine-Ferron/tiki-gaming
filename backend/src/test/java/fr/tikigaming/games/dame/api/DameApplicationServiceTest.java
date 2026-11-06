package fr.tikigaming.games.dame.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import fr.tikigaming.games.dame.matches.Match;
import fr.tikigaming.games.dame.persistence.MatchStorageException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpSession;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/** Invariants de l'orchestration, sans Spring, réseau ou base réelle. */
class DameApplicationServiceTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Instant NOW = Instant.parse("2026-11-05T12:00:00Z");
    private final ApiMatches repository = new ApiMatches();
    private final AtomicLong ids = new AtomicLong();
    private final DameApplicationService service = new DameApplicationService(
            repository, Clock.fixed(NOW, ZoneOffset.UTC), () -> new UUID(0, ids.incrementAndGet()), JSON);
    private final MockHttpSession session = new MockHttpSession();

    private DameGameView start() {
        DameGameView view = service.start(session, " Cherif ", " Amadou ");
        assertThat(view).isNotNull();
        return view;
    }

    @Test
    void recordsADrawAndRestoresItsHistoryWithoutAWinner() {
        DameGameView initial = start();
        Game game = new Game(
                new Board(Map.of(
                        new Position(0, 1), new Piece(Player.WHITE, true),
                        new Position(0, 7), new Piece(Player.BLACK, true))),
                Player.WHITE,
                new fr.tikigaming.games.dame.DrawState(Map.of(), 0, -1, 1));
        session.setAttribute(
                DameApplicationService.ATTRIBUTE,
                JSON.writeValueAsString(DameGameView.of(repository.rows.get(initial.id()), game, 9)));
        repository.fixture(DameGameView.of(repository.rows.get(initial.id()), game, 9), game.drawState());
        DameGameView result =
                service.play(session, initial.id(), 9, new Move(new Position(0, 1), List.of(new Position(1, 0))));
        assertThat(result.status()).isEqualTo(GameStatus.DRAW);
        assertThat(result.winner()).isNull();
        assertThat(result.legalMoves()).isEmpty();
        assertThat(result.finishedAt()).isNotNull();
        assertThat(repository.rows.get(initial.id()).status()).isEqualTo(GameStatus.DRAW);
        assertThat(service.read(session, initial.id())).isEqualTo(result);
    }

    @Test
    void createsAndReadsAnOwnedMatchWithFortyPiecesAndNoWinner() {
        DameGameView view = start();

        assertThat(view.whiteName()).isEqualTo("Cherif");
        assertThat(view.blackName()).isEqualTo("Amadou");
        assertThat(view.version()).isZero();
        assertThat(view.board().rows()).isEqualTo(10);
        assertThat(view.board().columns()).isEqualTo(10);
        assertThat(view.board().pieces()).hasSize(40);
        assertThat(view.currentPlayer()).isEqualTo(Player.WHITE);
        assertThat(view.status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(view.winner()).isNull();
        assertThat(view.finishedAt()).isNull();
        assertThat(view.legalMoves()).hasSize(9);
        assertThat(repository.rows.get(view.id()).status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(service.read(session, view.id())).isEqualTo(view);
        assertThat(repository.reads).isEqualTo(1);
    }

    @Test
    void sessionStateCanBeSerializedAndRestoredWithoutStoringTheMutableGame() {
        DameGameView view = start();
        assertThat(session.getAttribute(DameApplicationService.ATTRIBUTE)).isInstanceOf(String.class);
        MockHttpSession restored = new MockHttpSession();
        restored.deserializeState(session.serializeState());

        assertThat(service.read(restored, view.id())).isEqualTo(view);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
    void invalidNamesDoNotReplaceAnExistingGameOrWriteAnything(String name) {
        DameGameView previous = start();

        assertApi(() -> service.start(session, name, "Amadou"), HttpStatus.BAD_REQUEST);
        assertThat(service.read(session, previous.id())).isEqualTo(previous);
        assertThat(repository.writes).isEqualTo(1);
    }

    @Test
    void failedCreationKeepsThePreviousSessionGame() {
        DameGameView previous = start();
        repository.failBeforeWrite = true;

        assertThatThrownBy(() -> service.start(session, "Élodie", "Alex")).isInstanceOf(MatchStorageException.class);
        assertThat(service.read(session, previous.id())).isEqualTo(previous);
        assertThat(repository.rows).hasSize(1);
    }

    @Test
    void aNewMatchHasANewIdentityAndDoesNotResetTheOldDatabaseRecord() {
        DameGameView previous = start();
        DameGameView current = service.start(session, "Élodie", "Alex");

        assertThat(current).isNotNull();
        assertThat(current.id()).isNotEqualTo(previous.id());
        assertThat(repository.rows).hasSize(2);
        assertThat(service.read(session, current.id())).isEqualTo(current);
        assertApi(() -> service.read(session, previous.id()), HttpStatus.NOT_FOUND);
    }

    @Test
    void aForeignSessionCannotReadOrPlayEvenWithAKnownMatchIdentifier() {
        DameGameView owned = start();
        MockHttpSession stranger = new MockHttpSession();
        assertApi(() -> service.read(stranger, owned.id()), HttpStatus.NOT_FOUND);
        assertApi(() -> service.play(stranger, owned.id(), 0, ordinaryMove()), HttpStatus.NOT_FOUND);
        assertThat(repository.reads).isZero();
        assertThat(repository.writes).isEqualTo(1);
        assertThat(stranger.getAttribute(DameApplicationService.ATTRIBUTE)).isNull();
    }

    @Test
    void missingSessionsAndUnknownIdentifiersAreIndistinguishableFromForeignMatches() {
        assertApi(() -> service.read(null, new UUID(0, 999)), HttpStatus.NOT_FOUND);
        assertApi(() -> service.play(null, new UUID(0, 999), 0, ordinaryMove()), HttpStatus.NOT_FOUND);
        DameGameView view = start();
        assertApi(() -> service.read(session, new UUID(0, 999)), HttpStatus.NOT_FOUND);
        assertThat(service.read(session, view.id())).isEqualTo(view);
        assertThat(repository.reads).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"broken", "{}", "null", "[]"})
    void malformedSessionStateIsRejectedWithoutAccessingTheDatabase(String broken) {
        session.setAttribute(DameApplicationService.ATTRIBUTE, broken);

        assertApi(() -> service.read(session, new UUID(0, 1)), HttpStatus.NOT_FOUND);
        assertThat(repository.reads).isZero();
    }

    @Test
    void missingOrNonTextSessionStateIsRejectedBeforeReadingTheDatabase() {
        UUID id = new UUID(0, 1);
        assertApi(() -> service.read(session, id), HttpStatus.NOT_FOUND);
        session.setAttribute(DameApplicationService.ATTRIBUTE, 42);
        assertApi(() -> service.read(session, id), HttpStatus.NOT_FOUND);
        assertThat(repository.reads).isZero();
        assertThat(repository.writes).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"negative-version", "inconsistent-status", "duplicate-square"})
    void aDamagedPersistedSnapshotIsRefusedWithoutWriting(String damage) {
        DameGameView initial = start();
        ObjectNode snapshot = JSON.valueToTree(initial);
        switch (damage) {
            case "negative-version" -> snapshot.put("version", -1);
            case "inconsistent-status" -> snapshot.put("status", "WHITE_WON");
            case "duplicate-square" -> {
                ArrayNode pieces = (ArrayNode) snapshot.path("board").path("pieces");
                pieces.add(pieces.get(0).deepCopy());
            }
            default -> throw new AssertionError("Cas de test inconnu : " + damage);
        }
        String corrupted = JSON.writeValueAsString(snapshot);
        var saved = repository.saves.get(initial.id());
        var envelope = JSON.createObjectNode();
        envelope.set("view", JSON.readTree(corrupted));
        envelope.set("history", JSON.valueToTree(new Game().drawState()));
        repository.saves.put(
                initial.id(),
                new fr.tikigaming.games.dame.matches.GameSave(
                        saved.match(), saved.ownerHash(), saved.version(), JSON.writeValueAsString(envelope)));

        assertApi(() -> service.read(session, initial.id()), HttpStatus.NOT_FOUND);
        assertApi(() -> service.play(session, initial.id(), 0, ordinaryMove()), HttpStatus.NOT_FOUND);
        assertThat(repository.saves.get(initial.id()).state()).isEqualTo(JSON.writeValueAsString(envelope));
        assertThat(repository.reads).isEqualTo(2);
        assertThat(repository.writes).isEqualTo(1);
        assertThat(repository.rows.get(initial.id()).status()).isEqualTo(GameStatus.IN_PROGRESS);
    }

    @Test
    void anOrdinaryMovePersistsTheBoardAndKeepsTheMatchUnfinished() {
        DameGameView initial = start();

        DameGameView next = service.play(session, initial.id(), 0, ordinaryMove());

        assertThat(next).isNotNull();
        assertThat(next.version()).isEqualTo(1);
        assertThat(next.currentPlayer()).isEqualTo(Player.BLACK);
        assertThat(next.board().pieces()).hasSize(40);
        assertThat(next.game().board().pieceAt(new Position(5, 0))).contains(new Piece(Player.WHITE, false));
        assertThat(next.game().board().pieceAt(new Position(6, 1))).isEmpty();
        assertThat(repository.writes).isEqualTo(2);
        assertThat(repository.reads).isEqualTo(1);
        assertThat(service.read(session, initial.id())).isEqualTo(next);
        assertThat(initial.game().board().pieceAt(new Position(6, 1))).isPresent();
    }

    @Test
    void aRefusedMoveDoesNotChangeTheBoardTurnVersionOrDatabase() {
        DameGameView initial = start();
        Move illegal = new Move(new Position(6, 1), List.of(new Position(4, 1)));

        assertApi(() -> service.play(session, initial.id(), 0, illegal), HttpStatus.BAD_REQUEST);
        assertThat(service.read(session, initial.id())).isEqualTo(initial);
        assertThat(repository.writes).isEqualTo(1);
    }

    @Test
    void aStaleVersionCannotApplyASecondMove() {
        DameGameView initial = start();
        DameGameView next = service.play(session, initial.id(), 0, ordinaryMove());

        assertApi(() -> service.play(session, initial.id(), 0, ordinaryMove()), HttpStatus.CONFLICT);
        assertThat(service.read(session, initial.id())).isEqualTo(next);
    }

    @Test
    void concurrentCommandsFromTwoTabsApplyOnlyOnce() throws Exception {
        DameGameView initial = start();
        CyclicBarrier barrier = new CyclicBarrier(2);
        Callable<Integer> command = () -> {
            barrier.await(5, TimeUnit.SECONDS);
            try {
                service.play(session, initial.id(), 0, ordinaryMove());
                return 200;
            } catch (ApiException refusal) {
                return refusal.status().value();
            }
        };
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(command);
            var second = executor.submit(command);
            assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
        assertThat(service.read(session, initial.id()).version()).isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(Player.class)
    void theEngineDeterminesAndPersistsTheWinnerBeforeTheSessionIsCommitted(Player winner) {
        DameGameView before = beforeVictory(winner);

        DameGameView after = service.play(session, before.id(), 7, winningMove(winner));

        assertThat(after).isNotNull();
        assertThat(after.winner()).isEqualTo(winner);
        assertThat(after.version()).isEqualTo(8);
        assertThat(after.finishedAt()).isEqualTo(NOW.toString());
        assertThat(after.legalMoves()).isEmpty();
        assertThat(repository.rows.get(before.id()).winner()).contains(winner);
        assertThat(repository.writes).isEqualTo(2);
        assertThat(service.read(session, before.id())).isEqualTo(after);
        assertApi(() -> service.play(session, before.id(), 8, winningMove(winner)), HttpStatus.CONFLICT);
        assertThat(repository.writes).isEqualTo(2);
    }

    @Test
    void aFailedResultWriteKeepsTheLastMoveUncommittedAndCanBeRetried() {
        DameGameView before = beforeVictory(Player.WHITE);
        repository.failBeforeWrite = true;

        assertThatThrownBy(() -> service.play(session, before.id(), 7, winningMove(Player.WHITE)))
                .isInstanceOf(MatchStorageException.class);
        assertThat(service.read(session, before.id())).isEqualTo(before);
        assertThat(repository.rows.get(before.id()).status()).isEqualTo(GameStatus.IN_PROGRESS);

        repository.failBeforeWrite = false;
        assertThat(service.play(session, before.id(), 7, winningMove(Player.WHITE))
                        .winner())
                .isEqualTo(Player.WHITE);
    }

    @Test
    void aMissingPersistedMatchCannotCommitTheWinningMove() {
        DameGameView before = beforeVictory(Player.WHITE);
        repository.rows.remove(before.id());

        assertApi(() -> service.play(session, before.id(), 7, winningMove(Player.WHITE)), HttpStatus.NOT_FOUND);
        assertApi(() -> service.read(session, before.id()), HttpStatus.NOT_FOUND);
        assertThat(repository.rows).isEmpty();
        assertThat(repository.writes).isEqualTo(1);
    }

    @Test
    void aLostResponseAfterTheResultWasStoredCanBeConfirmedWithoutAnotherWrite() {
        DameGameView before = beforeVictory(Player.WHITE);
        repository.failAfterWrite = true;

        assertThatThrownBy(() -> service.play(session, before.id(), 7, winningMove(Player.WHITE)))
                .isInstanceOf(MatchStorageException.class);
        assertThat(service.read(session, before.id()).winner()).isEqualTo(Player.WHITE);
        assertThat(repository.rows.get(before.id()).status()).isEqualTo(GameStatus.WHITE_WON);
        repository.failAfterWrite = false;
        assertApi(() -> service.play(session, before.id(), 7, winningMove(Player.WHITE)), HttpStatus.CONFLICT);
        assertThat(repository.writes).isEqualTo(2);
    }

    @Test
    void aContradictoryStoredWinnerDoesNotAdvanceTheSession() {
        DameGameView before = beforeVictory(Player.WHITE);
        Match recorded = repository.rows.get(before.id()).finish(GameStatus.BLACK_WON, NOW);
        repository.rows.put(before.id(), recorded);

        assertApi(() -> service.play(session, before.id(), 7, winningMove(Player.WHITE)), HttpStatus.NOT_FOUND);
        assertApi(() -> service.read(session, before.id()), HttpStatus.NOT_FOUND);
        assertThat(repository.rows.get(before.id())).isEqualTo(recorded);
    }

    @Test
    void aVersionOverflowIsRefusedBeforeMutatingTheSession() {
        DameGameView initial = start();
        repository.fixture(
                DameGameView.of(repository.rows.get(initial.id()), new Game(), Integer.MAX_VALUE),
                new Game().drawState());

        assertApi(() -> service.play(session, initial.id(), Integer.MAX_VALUE, ordinaryMove()), HttpStatus.CONFLICT);
        assertThat(service.read(session, initial.id()).version()).isEqualTo(Integer.MAX_VALUE);
    }

    private DameGameView beforeVictory(Player camp) {
        DameGameView initial = start();
        Game game = new Game(
                new Board(Map.of(
                        new Position(6, 1), new Piece(Player.WHITE, false),
                        new Position(5, 2), new Piece(Player.BLACK, false))),
                camp);
        DameGameView before = DameGameView.of(repository.rows.get(initial.id()), game, 7);
        repository.fixture(before, game.drawState());
        return before;
    }

    static Move winningMove(Player camp) {
        return camp == Player.WHITE
                ? new Move(new Position(6, 1), List.of(new Position(4, 3)))
                : new Move(new Position(5, 2), List.of(new Position(7, 0)));
    }

    private static Move ordinaryMove() {
        return new Move(new Position(6, 1), List.of(new Position(5, 0)));
    }

    private static void assertApi(org.assertj.core.api.ThrowableAssert.ThrowingCallable command, HttpStatus status) {
        assertThatThrownBy(command)
                .isInstanceOfSatisfying(
                        ApiException.class, error -> assertThat(error.status()).isEqualTo(status));
    }
}
