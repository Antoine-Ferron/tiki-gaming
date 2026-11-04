package fr.tikigaming.games.sdv_civilisation;

import static fr.tikigaming.games.sdv_civilisation.Tables.ALICE;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_1;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_2;
import static fr.tikigaming.games.sdv_civilisation.Tables.age;
import static fr.tikigaming.games.sdv_civilisation.Tables.built;
import static fr.tikigaming.games.sdv_civilisation.Tables.hand;
import static fr.tikigaming.games.sdv_civilisation.Tables.player;
import static fr.tikigaming.games.sdv_civilisation.Tables.start;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AgeEndTest {

    // Stub (paquet non mélangé) + dummy (aucun trésor ne franchit le seuil d'alerte ici).
    private final Engine engine = new Engine(new StandardTrade(), FixedShuffler.KEEP, Dummy.audit());

    /** Dernier tour de l'âge : chaque joueur a 2 cartes et défausse la première. */
    private GameState lastTurnOf(int age, GameState game) {
        GameState lastTurn = hand(
                hand(
                        hand(Tables.age(game, age, Engine.TURNS_PER_AGE), ALICE, "Bains", "Chantier"),
                        IA_1,
                        "Filon",
                        "Cavité"),
                IA_2,
                "Verrerie",
                "Atelier");
        return engine.play(
                lastTurn,
                List.of(
                        new Action(ActionType.DISCARD, "Bains"),
                        new Action(ActionType.DISCARD, "Filon"),
                        new Action(ActionType.DISCARD, "Verrerie")));
    }

    @Test
    void eachPlayerFightsBothNeighboursAtTheEndOfTheAge() {
        // Étant donné "alice" qui a construit la "Palissade" (1 bouclier), face à deux IA sans bouclier
        GameState game = player(start("Citadelle d’Orkan"), ALICE, built("Palissade"));

        // Quand l'âge I se termine
        GameState next = lastTurnOf(1, game);

        // Alors alice gagne ses deux duels (+1 chacun), et chaque IA perd contre elle et fait égalité avec l'autre
        assertThat(next.conflicts()).containsExactly(2, -1, -1);
        assertThat(next.player(ALICE).tokens())
                .containsExactly(new MilitaryToken(1, "IA 2", 1), new MilitaryToken(1, "IA 1", 1));
        assertThat(next.player(IA_1).tokens())
                .containsExactly(new MilitaryToken(1, "alice", -1), new MilitaryToken(1, "IA 2", 0));
        assertThat(next.players()).extracting(PlayerState::military).containsExactly(2, -1, -1);
    }

    @ParameterizedTest(name = "âge {0} : victoire {1}")
    @CsvSource({"1, 1", "2, 3", "3, 5"})
    void aVictoryIsWorthMoreInEachAge(int age, int victory) {
        // Étant donné "alice" plus forte que ses deux voisins
        GameState game = player(start("Citadelle d’Orkan"), ALICE, built("Palissade"));

        // Quand l'âge se termine
        // Alors chaque victoire vaut 1, 3 puis 5 points ; une défaite coûte toujours 1 point
        assertThat(lastTurnOf(age, game).conflicts()).containsExactly(2 * victory, -1, -1);
    }

    @Test
    void theLastCardsAreDiscardedAndTheNextAgeStartsWithSevenNewCards() {
        // Quand l'âge I se termine
        GameState next = lastTurnOf(1, start("Citadelle d’Orkan"));

        // Alors la dernière carte de chaque main rejoint la défausse
        assertThat(next.discards())
                .extracting(Card::name)
                .containsExactlyInAnyOrder("Bains", "Filon", "Verrerie", "Chantier", "Cavité", "Atelier");
        // Et l'âge II commence au tour 1, avec 7 cartes de l'âge II pour chacun
        assertThat(next.age()).isEqualTo(2);
        assertThat(next.turn()).isEqualTo(1);
        assertThat(next.over()).isFalse();
        assertThat(next.hands())
                .allSatisfy(hand -> assertThat(hand)
                        .hasSize(Engine.HAND_SIZE)
                        .extracting(Card::age)
                        .containsOnly(2));
    }

    @Test
    void theGameIsOverAfterAgeThree() {
        // Quand l'âge III se termine
        GameState next = lastTurnOf(3, start("Citadelle d’Orkan"));

        // Alors la partie est terminée, sans nouvelle main
        assertThat(next.over()).isTrue();
        assertThat(next.hands()).allSatisfy(hand -> assertThat(hand).isEmpty());
        assertThat(next.age()).isEqualTo(3);
    }

    @Test
    void inTheMiddleOfAnAgeThereIsNoConflict() {
        // Quand on joue un tour qui n'est pas le dernier de l'âge
        GameState next = engine.play(
                age(start("Citadelle d’Orkan"), 1, 5),
                List.of(
                        new Action(ActionType.DISCARD, "Bains"),
                        new Action(ActionType.DISCARD, "Filon"),
                        new Action(ActionType.DISCARD, "Verrerie")));

        // Alors aucun duel n'a lieu
        assertThat(next.conflicts()).isEmpty();
        assertThat(next.turn()).isEqualTo(6);
    }
}
