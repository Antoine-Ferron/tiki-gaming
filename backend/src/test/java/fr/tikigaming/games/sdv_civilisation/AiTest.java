package fr.tikigaming.games.sdv_civilisation;

import static fr.tikigaming.games.sdv_civilisation.Tables.IA_1;
import static fr.tikigaming.games.sdv_civilisation.Tables.hand;
import static fr.tikigaming.games.sdv_civilisation.Tables.player;
import static fr.tikigaming.games.sdv_civilisation.Tables.stages;
import static fr.tikigaming.games.sdv_civilisation.Tables.start;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class AiTest {

    private final CurrencyConverter trade = new StandardTrade();

    // "IA 1" a le Temple d’Ysar (minerai) ; à sa gauche alice produit de la pierre, à sa droite "IA 2" du verre.

    @Test
    void buildsTheMostValuableBuildingItCanPay() {
        // Étant donné "IA 1" avec le "Chantier", la "Palissade" (pas de bois autour d'elle) et les "Bains"
        GameState game = hand(start("Citadelle d’Orkan"), IA_1, "Chantier", "Palissade", "Bains");

        // Quand elle choisit son action
        // Alors elle construit les "Bains" (3 points), en achetant la pierre à alice
        assertThat(Ai.choose(game, IA_1, trade)).isEqualTo(new Action(ActionType.BUILD, "Bains"));
    }

    @Test
    void otherwiseBuildsAWonderStageWithItsLeastValuableCard() {
        // Étant donné "IA 1" qui ne peut payer ni la "Bibliothèque" (2 pierres) ni les "Écuries" (bois)
        GameState game = hand(start("Citadelle d’Orkan"), IA_1, "Bibliothèque", "Écuries");

        // Quand elle choisit son action
        // Alors elle bâtit une étape de sa merveille avec la carte qui l'intéresse le moins
        assertThat(Ai.choose(game, IA_1, trade)).isEqualTo(new Action(ActionType.WONDER, "Bibliothèque"));
    }

    @Test
    void otherwiseDiscardsItsLeastValuableCard() {
        // Étant donné la même main, mais une merveille déjà terminée
        GameState game = player(hand(start("Citadelle d’Orkan"), IA_1, "Bibliothèque", "Écuries"), IA_1, stages(3));

        // Quand elle choisit son action
        // Alors elle défausse la carte qui l'intéresse le moins
        assertThat(Ai.choose(game, IA_1, trade)).isEqualTo(new Action(ActionType.DISCARD, "Bibliothèque"));
    }

    @Test
    void aWholeGamePlayedByTheAiGoesThroughTheThreeAges() {
        // Étant donné une partie où l'IA joue à la place de chaque joueur
        Engine engine = new Engine(trade, FixedShuffler.KEEP, new LogAuditNotifier());
        GameState game = start("Citadelle d’Orkan");

        // Quand on joue les 18 tours (3 âges de 6 tours)
        for (int turn = 0; turn < 3 * Engine.TURNS_PER_AGE; turn++) {
            GameState current = game;
            game = engine.play(
                    current,
                    IntStream.range(0, 3)
                            .mapToObj(i -> Ai.choose(current, i, trade))
                            .toList());
        }

        // Alors la partie est terminée et chacun a combattu ses deux voisins à chaque âge
        assertThat(game.over()).isTrue();
        assertThat(game.players()).allSatisfy(p -> assertThat(p.tokens()).hasSize(6));
        assertThat(Scoring.ranking(game)).hasSize(3);
    }
}
