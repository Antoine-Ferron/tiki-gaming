package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SetupTest {

    // Stub (mélange qui garde l'ordre) + dummies (ni commerce ni audit pendant la mise en place).
    private final Engine engine = new Engine(Dummy.converter(), FixedShuffler.KEEP, Dummy.audit());
    private final Wonder citadel = Wonders.byName("Citadelle d’Orkan");

    @Test
    void thePlayerSitsWithTwoAisAndEveryoneStartsWithThreeCoins() {
        // Quand "alice" commence une partie
        GameState game = engine.create("alice", citadel);

        // Alors elle est assise avec "IA 1" et "IA 2", qui sont des IA
        assertThat(game.players()).extracting(PlayerState::name).containsExactly("alice", "IA 1", "IA 2");
        assertThat(game.players()).extracting(PlayerState::bot).containsExactly(false, true, true);
        // Et chaque joueur a 3 pièces, aucun bâtiment, aucune étape de merveille, aucun jeton militaire
        assertThat(game.players()).allSatisfy(player -> {
            assertThat(player.coins()).isEqualTo(Engine.STARTING_COINS);
            assertThat(player.built()).isEmpty();
            assertThat(player.stagesBuilt()).isZero();
            assertThat(player.tokens()).isEmpty();
        });
    }

    @Test
    void thePlayerGetsTheChosenWonderAndTheAisGetTwoOthers() {
        // Quand "alice" choisit la "Citadelle d’Orkan"
        GameState game = engine.create("alice", citadel);

        // Alors elle l'a, et chaque IA reçoit une autre merveille
        List<Wonder> wonders = game.players().stream().map(PlayerState::wonder).toList();
        assertThat(wonders.getFirst()).isEqualTo(citadel);
        assertThat(wonders).doesNotHaveDuplicates();
        // Et son plateau produit déjà sa ressource
        assertThat(game.players().getFirst().production()).containsExactly(Resource.STONE);
    }

    @Test
    void everyoneReceivesSevenCardsOfAgeOneAndTheGameStartsAtTurnOne() {
        // Quand la partie commence
        GameState game = engine.create("alice", citadel);

        // Alors on est au tour 1 de l'âge I, sans défausse ni tour précédent
        assertThat(game.age()).isEqualTo(1);
        assertThat(game.turn()).isEqualTo(1);
        assertThat(game.over()).isFalse();
        assertThat(game.discards()).isEmpty();
        assertThat(game.lastTurn()).isEmpty();
        assertThat(game.conflicts()).isEmpty();
        // Et chaque joueur a 7 cartes de l'âge I (paquet non mélangé : alice reçoit le catalogue dans l'ordre)
        assertThat(game.hands())
                .hasSize(3)
                .allSatisfy(hand -> assertThat(hand)
                        .hasSize(Engine.HAND_SIZE)
                        .extracting(Card::age)
                        .containsOnly(1));
        assertThat(game.hands().getFirst()).isEqualTo(Cards.ofAge(1));
    }
}
