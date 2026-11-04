package fr.tikigaming.games.sdv_civilisation;

import static fr.tikigaming.games.sdv_civilisation.Tables.ALICE;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_1;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_2;
import static fr.tikigaming.games.sdv_civilisation.Tables.built;
import static fr.tikigaming.games.sdv_civilisation.Tables.coins;
import static fr.tikigaming.games.sdv_civilisation.Tables.military;
import static fr.tikigaming.games.sdv_civilisation.Tables.player;
import static fr.tikigaming.games.sdv_civilisation.Tables.stages;
import static fr.tikigaming.games.sdv_civilisation.Tables.start;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ScoringTest {

    @Test
    void theFinalScoreAddsUpEveryCategory() {
        // Étant donné "alice" avec 10 pièces, 4 points militaires, 2 étapes de la Citadelle d’Orkan (3 points),
        // les "Bains" et l'"Aqueduc" (3 + 5 points) et une série complète de science
        GameState game = player(
                player(player(player(start("Citadelle d’Orkan"), ALICE, coins(10)), ALICE, military(4)), ALICE, stages(2)),
                ALICE,
                built("Bains", "Aqueduc", "Atelier", "Bibliothèque", "Dispensaire"));

        // Quand on compte son score final
        ScoreBreakdown score = Scoring.finalScore(game, ALICE);

        // Alors chaque catégorie est comptée : 1 point pour 3 pièces, science 1² + 1² + 1² + 7
        assertThat(score).isEqualTo(new ScoreBreakdown(4, 3, 3, 8, 10, 0, 28));
    }

    @Test
    void aGuildCountsTheBuildingsOfBothNeighbours() {
        // Étant donné "IA 1" qui a construit le "Chantier" et la "Verrerie", et "IA 2" qui a construit la "Cavité"
        GameState game = player(
                player(start("Citadelle d’Orkan"), IA_1, built("Chantier", "Verrerie")), IA_2, built("Cavité"));
        // Et "alice" qui a construit la "Guilde des bâtisseurs" (cartes marron et grises des voisins)
        GameState withGuild = player(game, ALICE, built("Guilde des bâtisseurs"));

        // Alors "alice" marque 3 points de guilde
        assertThat(Scoring.finalScore(withGuild, ALICE).guilds()).isEqualTo(3);
    }

    @Test
    void theHighestTotalWinsAndCoinsBreakTies() {
        // Étant donné "alice" et "IA 1" à égalité de points (3 points de Bains chacune), "IA 1" plus riche
        GameState game = player(
                player(player(start("Citadelle d’Orkan"), ALICE, built("Bains")), IA_1, built("Bains")),
                IA_1,
                coins(5));

        // Quand on établit le classement final
        // Alors "IA 1" passe devant "alice" grâce à ses pièces, et "IA 2" est dernière
        assertThat(Scoring.ranking(game)).extracting(Ranked::name).containsExactly("IA 1", "alice", "IA 2");
        assertThat(Scoring.ranking(game).getFirst().score().total()).isEqualTo(4);
    }
}
