package fr.tikigaming.games.bang.cards;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

class BangCharacterTest {

    @Test
    void thereAreExactlyFourCharacters() {
        assertThat(BangCharacter.values())
                .containsExactly(
                        BangCharacter.BART_CASSIDY,
                        BangCharacter.CALAMITY_JANET,
                        BangCharacter.PAUL_REGRET,
                        BangCharacter.WILLY_THE_KID);
    }

    @ParameterizedTest
    @CsvSource({
        "BART_CASSIDY, Bart Cassidy, 4",
        "CALAMITY_JANET, Calamity Janet, 4",
        "PAUL_REGRET, Paul Regret, 3",
        "WILLY_THE_KID, Willy le Kid, 4"
    })
    void eachCharacterShowsItsNameAndStartingLife(BangCharacter character, String name, int life) {
        assertThat(character.label()).isEqualTo(name);
        assertThat(character.lifePoints()).isEqualTo(life);
    }

    @ParameterizedTest
    @EnumSource(BangCharacter.class)
    void eachCharacterShowsItsPower(BangCharacter character) {
        assertThat(character.power()).isNotBlank();
    }

    // --- Bart Cassidy : chaque PV perdu fait piocher une carte ---

    @ParameterizedTest
    @CsvSource({"BART_CASSIDY, 0, 0", "BART_CASSIDY, 1, 1", "BART_CASSIDY, 2, 2", "CALAMITY_JANET, 1, 0"})
    void bartDrawsOneCardPerLifePointLost(BangCharacter character, int lifeLost, int expectedDraw) {
        int drawn = character.cardsDrawnOnLifeLost(lifeLost);

        assertThat(drawn).isEqualTo(expectedDraw);
    }

    // --- Calamity Janet : BANG ! et Raté ! interchangeables ---

    @ParameterizedTest
    @CsvSource({"CALAMITY_JANET, BANG, MISSED", "CALAMITY_JANET, MISSED, BANG"})
    void calamityUsesABangAsAMissedAndViceVersa(BangCharacter character, CardType held, CardType needed) {
        boolean allowed = character.canUseAs(held, needed);

        assertThat(allowed).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"BART_CASSIDY, BANG, MISSED", "PAUL_REGRET, MISSED, BANG", "WILLY_THE_KID, BANG, MISSED"})
    void otherCharactersCannotSwapBangAndMissed(BangCharacter character, CardType held, CardType needed) {
        boolean allowed = character.canUseAs(held, needed);

        assertThat(allowed).isFalse();
    }

    @ParameterizedTest
    @EnumSource(BangCharacter.class)
    void everyoneUsesACardAsItself(BangCharacter character) {
        assertThat(character.canUseAs(CardType.BANG, CardType.BANG)).isTrue();
        assertThat(character.canUseAs(CardType.MISSED, CardType.MISSED)).isTrue();
    }

    // --- Paul Regret : vu à distance +1 par les adversaires ---

    @ParameterizedTest
    @CsvSource({"PAUL_REGRET, 1, 2", "PAUL_REGRET, 3, 4", "BART_CASSIDY, 1, 1", "WILLY_THE_KID, 3, 3"})
    void paulIsSeenOneStepFurtherAway(BangCharacter target, int distance, int expectedDistance) {
        int seen = target.distanceAsTarget(distance);

        assertThat(seen).isEqualTo(expectedDistance);
    }

    // --- Willy le Kid : plusieurs BANG ! par tour ---

    @Test
    void willyCanPlayManyBangsInATurn() {
        int limit = BangCharacter.WILLY_THE_KID.maxBangsPerTurn();

        assertThat(limit).isGreaterThan(1);
    }

    @ParameterizedTest
    @CsvSource({"BART_CASSIDY", "CALAMITY_JANET", "PAUL_REGRET"})
    void otherCharactersPlayOneBangPerTurn(BangCharacter character) {
        int limit = character.maxBangsPerTurn();

        assertThat(limit).isEqualTo(1);
    }
}
