package fr.tikigaming.games.sdv_civilisation;

import static fr.tikigaming.games.sdv_civilisation.Tables.ALICE;
import static fr.tikigaming.games.sdv_civilisation.Tables.IA_2;
import static fr.tikigaming.games.sdv_civilisation.Tables.built;
import static fr.tikigaming.games.sdv_civilisation.Tables.card;
import static fr.tikigaming.games.sdv_civilisation.Tables.coins;
import static fr.tikigaming.games.sdv_civilisation.Tables.player;
import static fr.tikigaming.games.sdv_civilisation.Tables.stages;
import static fr.tikigaming.games.sdv_civilisation.Tables.start;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class PaymentTest {

    // Spy : le vrai tarif du commerce (2 pièces l'unité), dont on vérifie ce qu'on lui a demandé.
    private final CurrencyConverter trade = spy(new StandardTrade());

    @Test
    void aFreeCardOrOneMadeWithItsOwnResourceCostsNothing() {
        // Étant donné "alice" avec la Citadelle d’Orkan, qui produit de la pierre
        GameState game = start("Citadelle d’Orkan");

        // Quand elle veut construire le "Chantier" (gratuit) ou les "Bains" (1 pierre)
        // Alors les deux sont constructibles sans rien payer ni acheter
        assertThat(Payments.build(game, ALICE, card("Chantier"), trade)).isEqualTo(Payment.paid(0, 0, 0));
        assertThat(Payments.build(game, ALICE, card("Bains"), trade)).isEqualTo(Payment.paid(0, 0, 0));
        verifyNoMoreInteractions(trade);
    }

    @Test
    void aMissingResourceIsBoughtFromTheNeighbourWhoProducesIt() {
        // Étant donné "alice" sans verre, et "IA 2", son voisin de gauche, qui produit du verre
        GameState game = start("Citadelle d’Orkan");

        // Quand elle veut construire l'"Atelier" (1 verre)
        Payment payment = Payments.build(game, ALICE, card("Atelier"), trade);

        // Alors elle paie 2 pièces à "IA 2" pour 1 verre
        assertThat(payment).isEqualTo(Payment.paid(2, 2, 0));
        verify(trade).toCoins(Resource.GLASS, 1);
    }

    @Test
    void theLeftNeighbourSellsFirstThenTheRightOne() {
        // Étant donné "IA 2" (gauche) et "IA 1" (droite) qui produisent chacun un minerai
        GameState game = player(start("Citadelle d’Orkan"), IA_2, built("Filon"));

        // Quand "alice" a besoin de 2 minerais
        // Alors elle en achète un à chacun, en commençant par la gauche
        assertThat(Payments.breakdown(game, ALICE, Cost.of(Resource.ORE, Resource.ORE)))
                .containsExactly(new ResourceNeed(Resource.ORE, 2, 0, 1, 1, 0));
    }

    @Test
    void aChainMakesTheNextBuildingFree() {
        // Étant donné "alice" qui a construit les "Bains"
        GameState game = player(start("Temple d’Ysar"), ALICE, built("Bains"));

        // Quand elle veut construire l'"Aqueduc" (3 pierres, chaîné depuis les Bains)
        // Alors il est gratuit grâce à la chaîne, sans commerce
        assertThat(Payments.build(game, ALICE, card("Aqueduc"), trade)).isEqualTo(Payment.CHAIN);
        verifyNoMoreInteractions(trade);
    }

    @ParameterizedTest(name = "{2} avec {0} pièces et « {1} » déjà construit : {3}")
    @CsvSource({
        "3, Chantier, Chantier, BUILT, Tu as déjà construit cette carte.",
        "3, Verrerie, Bains, RESOURCES, Il te manque des ressources.",
        "0, Verrerie, Filon, COINS, Pas assez de pièces.",
        "1, Verrerie, Atelier, COINS, Pas assez de pièces."
    })
    void aBuildingThatCannotBeBuiltIsRefused(
            int coins, String alreadyBuilt, String wanted, Refusal refusal, String reason) {
        // Étant donné "alice" (Temple d’Ysar : minerai) entre deux voisins sans pierre
        GameState game = player(
                player(start("Temple d’Ysar"), ALICE, coins(coins)), ALICE, built(alreadyBuilt));

        // Quand elle veut construire la carte
        Payment payment = Payments.build(game, ALICE, card(wanted), trade);

        // Alors c'est refusé, avec la raison à afficher
        assertThat(payment).isEqualTo(Payment.refused(refusal));
        assertThat(payment.reason()).isEqualTo(reason);
    }

    @Test
    void aWonderStageIsPaidLikeABuildingUntilTheWonderIsFinished() {
        // Étant donné "alice" et sa Citadelle d’Orkan (étape 1 : 1 pierre, qu'elle produit)
        GameState game = start("Citadelle d’Orkan");

        // Alors l'étape 1 ne lui coûte rien, et ses ressources sont détaillées
        assertThat(Payments.wonder(game, ALICE, trade)).isEqualTo(Payment.paid(0, 0, 0));
        assertThat(Payments.wonderNeeds(game, ALICE)).containsExactly(new ResourceNeed(Resource.STONE, 1, 1, 0, 0, 0));

        // Mais une fois les 3 étapes bâties, il n'y a plus d'étape à construire
        GameState finished = player(game, ALICE, stages(3));
        assertThat(Payments.wonder(finished, ALICE, trade)).isEqualTo(Payment.refused(Refusal.WONDER));
        assertThat(Payments.wonderNeeds(finished, ALICE)).isEmpty();
    }
}
