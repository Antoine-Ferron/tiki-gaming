package fr.tikigaming.games.sdv_civilisation;

import static fr.tikigaming.games.sdv_civilisation.Tables.ALICE;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_1;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_2;
import static fr.tikigaming.games.sdv_civilisation.Tables.card;
import static fr.tikigaming.games.sdv_civilisation.Tables.start;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;

class TimeoutTest {

    private final CurrencyConverter trade = new StandardTrade();
    // Mock : le journal d'audit, pour vérifier le signalement d'inactivité.
    private final AuditNotifier audit = mock(AuditNotifier.class);

    @Test
    void theAisPlayTheirOwnTurnNextToThePlayer() {
        // Étant donné une partie qui commence
        GameState game = start("Citadelle d’Orkan");
        Engine engine = new Engine(trade, FixedShuffler.KEEP, audit);

        // Quand "alice" défausse les "Bains"
        GameState next = engine.playAgainstAis(game, new Action(ActionType.DISCARD, "Bains"));

        // Alors chaque IA a joué l'action que son IA choisit, sans signalement d'inactivité
        assertThat(next.lastTurn().get(IA_1).card().name())
                .isEqualTo(Ai.choose(game, IA_1, trade).card());
        assertThat(next.lastTurn().get(IA_2).card().name())
                .isEqualTo(Ai.choose(game, IA_2, trade).card());
        verifyNoInteractions(audit);
    }

    @Test
    void whenTheTimerRunsOutARandomCardOfThePlayerIsDiscarded() {
        // Étant donné une partie au tour 1, et un mélangeur figé qui tire la dernière carte de la main (stub)
        GameState game = start("Citadelle d’Orkan");
        Engine engine = new Engine(trade, FixedShuffler.REVERSE, audit);

        // Quand le minuteur d'"alice" expire (heure limite 61 000)
        GameState next = engine.timeOut(game, 61_000);

        // Alors sa carte tirée au hasard, l'"Atelier", est défaussée : +3 pièces
        assertThat(next.lastTurn().get(ALICE)).isEqualTo(new TurnEvent(ALICE, ActionType.DISCARD, card("Atelier"), 3));
        assertThat(next.discards()).extracting(Card::name).contains("Atelier");
        assertThat(next.turn()).isEqualTo(2);
        // Et le journal d'audit signale qu'elle a laissé passer son tour
        verify(audit).inactivityDetected(new InactivityReport("alice", 61_000));
    }

    @Test
    void aTurnTimerCanBeResumedFromItsOfficialDeadline() {
        // Étant donné un tour dont l'heure limite officielle est 61 000 (fake : l'horloge avance à la main)
        FakeClock clock = new FakeClock(55_000);
        TurnTimer turn = TurnTimer.resume(clock, 61_000);

        // Alors il reste 6 s : c'est la dernière ligne droite
        assertThat(turn.remainingMillis()).isEqualTo(6_000);
        assertThat(turn.phase()).isEqualTo(TurnPhase.WARNING);
        // Et une fois l'heure dépassée, le tour est expiré
        clock.advance(6_000);
        assertThat(turn.phase()).isEqualTo(TurnPhase.EXPIRED);
    }
}
