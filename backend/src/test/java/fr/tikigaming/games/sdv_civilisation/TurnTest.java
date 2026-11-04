package fr.tikigaming.games.sdv_civilisation;

import static fr.tikigaming.games.sdv_civilisation.Tables.ALICE;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_1;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_2;
import static fr.tikigaming.games.sdv_civilisation.Tables.age;
import static fr.tikigaming.games.sdv_civilisation.Tables.card;
import static fr.tikigaming.games.sdv_civilisation.Tables.coins;
import static fr.tikigaming.games.sdv_civilisation.Tables.hand;
import static fr.tikigaming.games.sdv_civilisation.Tables.player;
import static fr.tikigaming.games.sdv_civilisation.Tables.stages;
import static fr.tikigaming.games.sdv_civilisation.Tables.start;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TurnTest {

    // Mock : le journal d'audit, dont on vérifie les signalements sans écrire de vrai journal.
    private final AuditNotifier audit = mock(AuditNotifier.class);
    private final Engine engine = new Engine(new StandardTrade(), FixedShuffler.KEEP, audit);

    /** "alice" joue l'action donnée, les deux IA défaussent une carte que personne d'autre ne joue. */
    private GameState aliceDoes(GameState game, ActionType type, String card) {
        return engine.play(
                game,
                List.of(
                        new Action(type, card),
                        new Action(ActionType.DISCARD, "Filon"),
                        new Action(ActionType.DISCARD, "Verrerie")));
    }

    @Test
    void buildingAFreeCardAddsItToTheCityAndRemovesItFromTheHand() {
        // Étant donné une partie qui commence
        GameState game = start("Citadelle d’Orkan");

        // Quand "alice" construit le "Chantier"
        GameState next = aliceDoes(game, ActionType.BUILD, "Chantier");

        // Alors elle produit du bois, sans avoir rien payé
        assertThat(next.player(ALICE).production()).contains(Resource.WOOD);
        assertThat(next.player(ALICE).coins()).isEqualTo(3);
        // Et le tour suivant commence, avec ce que chacun a joué
        assertThat(next.turn()).isEqualTo(2);
        assertThat(next.lastTurn().getFirst()).isEqualTo(new TurnEvent(ALICE, ActionType.BUILD, card("Chantier"), 0));
        assertThat(next.conflicts()).isEmpty();
    }

    @Test
    void buyingFromANeighbourMovesTheCoinsToHim() {
        // Étant donné "alice" sans verre, et "IA 2" (à sa gauche) qui en produit
        GameState game = start("Citadelle d’Orkan");

        // Quand "alice" construit l'"Atelier"
        GameState next = aliceDoes(game, ActionType.BUILD, "Atelier");

        // Alors elle a payé 2 pièces à "IA 2", qui a aussi gagné 3 pièces en défaussant
        assertThat(next.player(ALICE).coins()).isEqualTo(1);
        assertThat(next.player(IA_2).coins()).isEqualTo(3 + 2 + 3);
        assertThat(next.lastTurn()).extracting(TurnEvent::coins).containsExactly(-2, 3, 5);
    }

    @Test
    void aWonderStageHidesTheCardAndGivesItsReward() {
        // Étant donné "alice" avec 4 pièces et le Phare de Sélène, dont l'étape 1 (1 bois) est déjà bâtie
        GameState game = player(player(start("Phare de Sélène"), ALICE, stages(1)), ALICE, coins(4));

        // Quand elle bâtit l'étape 2 (2 pierres, +6 pièces) avec les "Bains", en achetant 2 pierres
        GameState withStone = player(game, IA_1, Tables.built("Cavité"));
        GameState next = aliceDoes(player(withStone, IA_2, Tables.built("Cavité")), ActionType.WONDER, "Bains");

        // Alors sa merveille a 2 étapes, et les "Bains" ne sont ni construits ni défaussés
        assertThat(next.player(ALICE).stagesBuilt()).isEqualTo(2);
        assertThat(next.player(ALICE).built()).isEmpty();
        assertThat(next.discards()).extracting(Card::name).doesNotContain("Bains");
        // Et elle a payé 4 pièces à ses voisins, puis reçu les 6 pièces de l'étape
        assertThat(next.player(ALICE).coins()).isEqualTo(4 - 4 + 6);
    }

    @Test
    void discardingACardGivesThreeCoinsAndPutsItOnTheDiscardPile() {
        // Quand "alice" défausse les "Bains"
        GameState next = aliceDoes(start("Citadelle d’Orkan"), ActionType.DISCARD, "Bains");

        // Alors elle a 6 pièces, et la défausse contient les "Bains"
        assertThat(next.player(ALICE).coins()).isEqualTo(6);
        assertThat(next.discards()).extracting(Card::name).containsExactly("Bains", "Filon", "Verrerie");
    }

    @Test
    void playingOneCopyOfACardLeavesTheOtherInTheHand() {
        // Étant donné "alice" qui a deux "Chantier" en main
        GameState game = hand(start("Citadelle d’Orkan"), ALICE, "Chantier", "Chantier", "Bains");

        // Quand elle en défausse un
        GameState next = aliceDoes(game, ActionType.DISCARD, "Chantier");

        // Alors la main qu'elle passe à "IA 2" contient encore un "Chantier"
        assertThat(next.hands().get(IA_2)).extracting(Card::name).containsExactly("Chantier", "Bains");
    }

    @ParameterizedTest(name = "âge {0} : alice reçoit la main de {1}")
    @CsvSource({"1, IA 1", "2, IA 2", "3, IA 1"})
    void handsPassToTheLeftInAgesOneAndThreeAndToTheRightInAgeTwo(int age, String neighbour) {
        // Étant donné la partie à l'âge donné, chaque joueur avec une main reconnaissable
        GameState game = hand(
                hand(
                        hand(age(start("Citadelle d’Orkan"), age, 1), ALICE, "Bains", "Chantier"),
                        IA_1,
                        "Filon",
                        "Cavité"),
                IA_2,
                "Verrerie",
                "Atelier");

        // Quand chacun défausse sa première carte
        GameState next = engine.play(
                game,
                List.of(
                        new Action(ActionType.DISCARD, "Bains"),
                        new Action(ActionType.DISCARD, "Filon"),
                        new Action(ActionType.DISCARD, "Verrerie")));

        // Alors "alice" reçoit la main de son voisin, selon l'âge
        String expected = neighbour.equals("IA 1") ? "Cavité" : "Atelier";
        assertThat(next.hands().get(ALICE)).extracting(Card::name).containsExactly(expected);
        assertThat(Engine.passesLeft(age)).isEqualTo(age != 2);
    }

    @Test
    void aCardThatIsNotInTheHandOrCannotBeBuiltIsRefused() {
        // Étant donné "alice" sans pierre, entre deux voisins sans pierre (Temple d’Ysar)
        GameState game = start("Temple d’Ysar");

        // Quand elle joue une carte absente de sa main, ou des "Bains" qu'elle ne peut pas payer
        // Alors c'est refusé, avec la raison à afficher
        assertThatThrownBy(() -> aliceDoes(game, ActionType.BUILD, "Aqueduc"))
                .isInstanceOf(GameRuleException.class)
                .hasMessage("Cette carte n'est pas dans ta main : Aqueduc");
        assertThatThrownBy(() -> aliceDoes(game, ActionType.BUILD, "Bains"))
                .isInstanceOf(GameRuleException.class)
                .hasMessage("Il te manque des ressources.");
        assertThatThrownBy(() -> aliceDoes(player(game, ALICE, stages(3)), ActionType.WONDER, "Bains"))
                .hasMessage("Ta merveille est déjà terminée.");
        verifyNoInteractions(audit);
    }

    @Test
    void aTreasuryThatReachesThirtyCoinsIsReportedToTheAudit() {
        // Étant donné "alice" qui a 27 pièces
        GameState game = player(start("Citadelle d’Orkan"), ALICE, coins(27));

        // Quand elle défausse une carte (+3 pièces)
        aliceDoes(game, ActionType.DISCARD, "Bains");

        // Alors le journal d'audit signale son trésor de 30 pièces
        verify(audit).treasuryThresholdCrossed(new TreasuryAlert("alice", 30, Treasury.ALERT_THRESHOLD));
    }
}
