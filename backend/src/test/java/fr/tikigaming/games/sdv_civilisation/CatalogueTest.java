package fr.tikigaming.games.sdv_civilisation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CatalogueTest {

    @ParameterizedTest(name = "âge {0}")
    @ValueSource(ints = {1, 2, 3})
    void eachAgeHasSevenDifferentCardsOfThatAge(int age) {
        // Quand on ouvre le paquet de l'âge
        List<Card> deck = Cards.ofAge(age);

        // Alors il contient 7 cartes différentes, toutes de cet âge
        assertThat(deck).hasSize(Cards.PER_AGE).extracting(Card::age).containsOnly(age);
        assertThat(deck).extracting(Card::name).doesNotHaveDuplicates();
    }

    @Test
    void everyChainStartsFromACardOfAnEarlierAge() {
        // Étant donné toutes les cartes qui se construisent gratuitement par chaîne
        List<Card> chained = IntStream.rangeClosed(1, 3)
                .mapToObj(Cards::ofAge)
                .flatMap(List::stream)
                .filter(card -> card.chainFrom() != null)
                .toList();

        // Alors chacune part d'une carte d'un âge antérieur (l'Observatoire de l'âge III part de l'Atelier de l'âge I)
        assertThat(chained)
                .isNotEmpty()
                .allSatisfy(card -> assertThat(IntStream.range(1, card.age())
                                .mapToObj(Cards::ofAge)
                                .flatMap(List::stream))
                        .extracting(Card::name)
                        .contains(card.chainFrom()));
    }

    @Test
    void fourWondersEachProduceTheirOwnResourceAndHaveThreeStages() {
        // Alors chaque plateau merveille produit une ressource différente et se bâtit en 3 étapes
        assertThat(Wonders.ALL).hasSize(4).extracting(Wonder::resource).doesNotHaveDuplicates();
        assertThat(Wonders.ALL).allSatisfy(wonder -> assertThat(wonder.stages()).hasSize(3));
        // Et on retrouve un plateau par son nom
        assertThat(Wonders.byName("Citadelle d’Orkan").resource()).isEqualTo(Resource.STONE);
    }

    @Test
    void anUnknownAgeOrWonderIsRefused() {
        // Quand on demande un âge ou une merveille qui n'existe pas
        // Alors c'est refusé, avec un message pour le joueur
        assertThatThrownBy(() -> Cards.ofAge(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Cards.ofAge(4)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Wonders.byName("Tour de Babel"))
                .isInstanceOf(GameRuleException.class)
                .hasMessage("Merveille inconnue : Tour de Babel");
    }
}
