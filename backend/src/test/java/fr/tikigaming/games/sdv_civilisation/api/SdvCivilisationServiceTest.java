package fr.tikigaming.games.sdv_civilisation.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import fr.tikigaming.games.sdv_civilisation.ActionType;
import fr.tikigaming.games.sdv_civilisation.AuditNotifier;
import fr.tikigaming.games.sdv_civilisation.Engine;
import fr.tikigaming.games.sdv_civilisation.FakeClock;
import fr.tikigaming.games.sdv_civilisation.FixedShuffler;
import fr.tikigaming.games.sdv_civilisation.GameRuleException;
import fr.tikigaming.games.sdv_civilisation.InactivityReport;
import fr.tikigaming.games.sdv_civilisation.Refusal;
import fr.tikigaming.games.sdv_civilisation.StandardTrade;
import fr.tikigaming.games.sdv_civilisation.TurnTimer;
import org.junit.jupiter.api.Test;

class SdvCivilisationServiceTest {

    private static final String USER = "user-1";
    private static final String CITADEL = "Citadelle d’Orkan";

    // Fakes (horloge réglée à la main, stockage en mémoire), stub (paquet non mélangé), mock (audit),
    // spy (scores enregistrés pour un joueur connecté).
    private final FakeClock clock = new FakeClock(1_000);
    private final AuditNotifier audit = mock(AuditNotifier.class);
    private final InMemoryGameStore store = new InMemoryGameStore();
    private final RecordingScoreRecorder scores = new RecordingScoreRecorder();
    private final SdvCivilisationService service = service(scores);

    private SdvCivilisationService service(ScoreRecorder recorder) {
        StandardTrade trade = new StandardTrade();
        return new SdvCivilisationService(new Engine(trade, FixedShuffler.KEEP, audit), trade, clock, recorder);
    }

    /** Joue toute la partie en défaussant chaque fois la première carte de la main (toujours permis). */
    private GameView playToTheEnd(SdvCivilisationService service, String userId) {
        GameView view = service.start(store, CITADEL);
        while (!view.over()) view = service.play(store, userId, 0, ActionType.DISCARD, view.version());
        return view;
    }

    @Test
    void aNewGameStartsAtTurnOneWithAFullTurnTimerAndOnlyThePlayersHand() {
        // Quand le joueur commence une partie avec la Citadelle d’Orkan
        GameView view = service.start(store, CITADEL);

        // Alors elle est enregistrée en version 1, au tour 1 de l'âge I, avec 60 s pour jouer
        assertThat(view.version()).isEqualTo(1);
        assertThat(view.age()).isEqualTo(1);
        assertThat(view.turn()).isEqualTo(1);
        assertThat(view.remainingMs()).isEqualTo(TurnTimer.DURATION_MILLIS);
        assertThat(store.load()).isPresent();
        // Et il ne voit que sa main, chaque carte avec son prix ; jamais celles des IA
        assertThat(view.hand()).hasSize(Engine.HAND_SIZE);
        assertThat(view.hand().getFirst().build().ok()).isTrue();
        assertThat(view.players()).extracting(p -> p.name()).containsExactly("Toi", "IA 1", "IA 2");
    }

    @Test
    void theGameInProgressIsFoundAgainToBeResumed() {
        // Étant donné aucune partie, puis une partie commencée
        assertThat(service.current(store, USER)).isEmpty();
        GameView started = service.start(store, CITADEL);

        // Quand le joueur revient plus tard (dans le temps du tour)
        clock.advance(30_000);

        // Alors il retrouve la même partie, avec le temps qui reste
        GameView resumed = service.current(store, USER).orElseThrow();
        assertThat(resumed.version()).isEqualTo(started.version());
        assertThat(resumed.hand()).isEqualTo(started.hand());
        assertThat(resumed.remainingMs()).isEqualTo(30_000);
    }

    @Test
    void playingATurnSavesTheNextOneAndShowsWhatEveryonePlayed() {
        // Étant donné une partie commencée
        GameView started = service.start(store, CITADEL);

        // Quand le joueur défausse sa première carte
        GameView next = service.play(store, USER, 0, ActionType.DISCARD, started.version());

        // Alors le tour 2 est enregistré en version 2, avec la main reçue du voisin et le tour de chacun
        assertThat(next.version()).isEqualTo(2);
        assertThat(next.turn()).isEqualTo(2);
        assertThat(next.hand()).hasSize(Engine.HAND_SIZE - 1);
        assertThat(next.lastTurn()).hasSize(3);
        assertThat(store.load().orElseThrow().version()).isEqualTo(2);
    }

    @Test
    void aMoveSentForAnOutdatedVersionIsRefusedWithTheCurrentGame() {
        // Étant donné une partie dont le tour 1 a déjà été joué (depuis un autre onglet)
        GameView started = service.start(store, CITADEL);
        service.play(store, USER, 0, ActionType.DISCARD, started.version());

        // Quand un deuxième coup arrive pour la version 1
        // Alors il est refusé, avec la partie à jour pour se resynchroniser
        assertThatThrownBy(() -> service.play(store, USER, 0, ActionType.DISCARD, started.version()))
                .isInstanceOfSatisfying(GameConflictException.class, e -> {
                    assertThat(e.getMessage()).isEqualTo(SdvCivilisationService.STALE);
                    assertThat(e.game().version()).isEqualTo(2);
                });
    }

    @Test
    void aSaveThatLosesTheRaceAgainstAnotherTabIsRefusedWithTheStoredGame() {
        // Étant donné une partie qu'un autre onglet modifie au même instant (stub : l'enregistrement échoue toujours)
        GameView started = service.start(store, CITADEL);
        GameStore racing = new GameStore() {
            @Override
            public java.util.Optional<SavedGame> load() {
                return store.load();
            }

            @Override
            public void save(SavedGame game, int expectedVersion) {
                throw new StaleGameException();
            }

            @Override
            public void clear() {
                store.clear();
            }
        };

        // Quand le joueur joue son coup
        // Alors il est refusé, avec la partie telle qu'elle est enregistrée
        assertThatThrownBy(() -> service.play(racing, USER, 0, ActionType.DISCARD, started.version()))
                .isInstanceOfSatisfying(
                        GameConflictException.class,
                        e -> assertThat(e.game().version()).isEqualTo(1));
    }

    @Test
    void anIllegalMoveIsRefusedAndChangesNothing() {
        // Étant donné une partie commencée, avec 7 cartes en main (positions 0 à 6)
        GameView started = service.start(store, CITADEL);

        // Quand le joueur joue la carte en position 7, qui n'existe pas
        // Alors c'est refusé, et la partie enregistrée n'a pas bougé
        assertThatThrownBy(() -> service.play(store, USER, 7, ActionType.DISCARD, started.version()))
                .isInstanceOf(GameRuleException.class)
                .hasMessage(SdvCivilisationService.NOT_IN_HAND);
        assertThat(store.load().orElseThrow().version()).isEqualTo(1);
    }

    @Test
    void whenTheTimerHasRunOutARandomCardIsDiscardedOnTheNextRequest() {
        // Étant donné une partie dont le joueur a laissé passer les 60 s du tour
        service.start(store, CITADEL);
        clock.advance(TurnTimer.DURATION_MILLIS);

        // Quand il revient
        GameView view = service.current(store, USER).orElseThrow();

        // Alors une de ses cartes a été défaussée à sa place, et le tour suivant a un nouveau minuteur
        assertThat(view.turn()).isEqualTo(2);
        assertThat(view.lastTurn().getFirst().action()).isEqualTo(ActionType.DISCARD);
        assertThat(view.remainingMs()).isEqualTo(TurnTimer.DURATION_MILLIS);
        verify(audit).inactivityDetected(new InactivityReport("Toi", 61_000));
    }

    @Test
    void aMoveSentAfterTheDeadlineIsRefusedBecauseTheTurnIsAlreadyResolved() {
        // Étant donné une partie dont le minuteur vient d'expirer
        GameView started = service.start(store, CITADEL);
        clock.advance(TurnTimer.DURATION_MILLIS + 1);

        // Quand le coup arrive trop tard
        // Alors il est refusé : la carte a déjà été défaussée au hasard
        assertThatThrownBy(() -> service.play(store, USER, 0, ActionType.BUILD, started.version()))
                .isInstanceOfSatisfying(GameConflictException.class, e -> {
                    assertThat(e.getMessage()).isEqualTo(SdvCivilisationService.EXPIRED);
                    assertThat(e.game().turn()).isEqualTo(2);
                });
    }

    @Test
    void theScoreOfAConnectedPlayerIsRecordedOnceAtTheEnd() {
        // Quand un joueur connecté joue les 18 tours
        GameView end = playToTheEnd(service, USER);

        // Alors la partie est terminée avec un classement, et son score a été enregistré une seule fois
        assertThat(end.over()).isTrue();
        assertThat(end.ranking()).hasSize(3);
        assertThat(scores.recorded).hasSize(1);
        assertThat(scores.recorded.getFirst().userId()).isEqualTo(USER);
        // Et on ne peut plus jouer de coup
        assertThatThrownBy(() -> service.play(store, USER, 0, ActionType.DISCARD, end.version()))
                .hasMessage(SdvCivilisationService.OVER);
    }

    @Test
    void aGuestPlaysWithoutRecordingAnyScore() {
        // Étant donné un invité (le dummy échoue si on tente d'enregistrer un score)
        SdvCivilisationService guest = service(new DummyScoreRecorder());

        // Quand il joue toute une partie
        // Alors elle se termine sans enregistrer de score
        assertThat(playToTheEnd(guest, null).over()).isTrue();
    }

    @Test
    void abandoningForgetsTheGameAndAnUnknownWonderIsRefused() {
        // Étant donné une partie commencée
        service.start(store, CITADEL);

        // Quand le joueur l'abandonne
        service.abandon(store);

        // Alors il n'a plus de partie à reprendre, ni de coup à jouer
        assertThat(service.current(store, USER)).isEmpty();
        assertThatThrownBy(() -> service.play(store, USER, 0, ActionType.DISCARD, 1))
                .isInstanceOf(NoGameException.class);
        // Et une merveille inconnue ne permet pas de commencer
        assertThatThrownBy(() -> service.start(store, "Tour de Babel")).isInstanceOf(GameRuleException.class);
    }

    @Test
    void theTimerOfAFinishedGameNeverExpires() {
        // Étant donné une partie terminée
        GameView end = playToTheEnd(service, USER);

        // Quand le joueur revient bien après l'heure limite du dernier tour (fake : l'horloge avance à la main)
        clock.advance(10 * TurnTimer.DURATION_MILLIS);

        // Alors il retrouve la partie terminée, inchangée, sans carte défaussée à sa place
        GameView again = service.current(store, USER).orElseThrow();
        assertThat(again.version()).isEqualTo(end.version());
        assertThat(again.over()).isTrue();
        verify(audit, never()).inactivityDetected(any());
    }

    @Test
    void aCardAlreadyBuiltInTheHandShowsNoResourceToBuy() {
        // Étant donné un joueur qui construit l'"Atelier" au tour 1 (verre acheté à "IA 2")
        GameView started = service.start(store, CITADEL);
        GameView next = service.play(store, USER, 6, ActionType.BUILD, started.version());

        // Quand il reçoit au tour 2 une main qui contient un autre "Atelier"
        GameView.HandCard atelier = next.hand().stream()
                .filter(c -> c.card().name().equals("Atelier"))
                .findFirst()
                .orElseThrow();

        // Alors la carte est refusée (déjà construite), sans ressource à acheter affichée
        assertThat(atelier.build().refusal()).isEqualTo(Refusal.BUILT);
        assertThat(atelier.needs()).isEmpty();
    }
}
