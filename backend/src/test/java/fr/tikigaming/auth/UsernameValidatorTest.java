package fr.tikigaming.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/** Test unitaire pur du validateur : partitions et valeurs limites, sans contexte Spring. */
class UsernameValidatorTest {

    private static final String TOO_SHORT = "Le pseudo doit contenir au moins 3 caractères.";
    private static final String TOO_LONG = "Le pseudo doit contenir au plus 24 caractères.";

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   "})
    void asksForAUsernameWhenMissing(String value) {
        assertThat(UsernameValidator.problem(value)).isEqualTo("Choisis un pseudo.");
    }

    // Bornes de chaque plage autorisée (a-z, A-Z, 0-9) et le _ : tous acceptés
    @ParameterizedTest
    @ValueSource(strings = {"aaa", "zzz", "AAA", "ZZZ", "000", "999", "___", "Anathos_42"})
    void acceptsLettersDigitsAndUnderscore(String value) {
        assertThat(UsernameValidator.problem(value)).isNull();
    }

    // Caractères juste avant / après chaque plage ASCII autorisée : ` { @ [ / :
    @ParameterizedTest
    @ValueSource(chars = {'`', '{', '@', '[', '/', ':'})
    void rejectsCharactersAdjacentToAllowedRanges(char forbidden) {
        assertThat(UsernameValidator.problem("abc" + forbidden))
                .isEqualTo("Caractère non autorisé : " + forbidden
                        + " — utilise uniquement des lettres sans accent, des chiffres et _.");
    }

    @ParameterizedTest
    @ValueSource(strings = {"ab", "a"})
    void rejectsUnderThreeCharacters(String value) {
        assertThat(UsernameValidator.problem(value)).isEqualTo(TOO_SHORT);
    }

    @ParameterizedTest
    @ValueSource(ints = {3, 4, 23, 24})
    void acceptsLengthsWithinBounds(int length) {
        assertThat(UsernameValidator.problem("a".repeat(length))).isNull();
    }

    @ParameterizedTest
    @ValueSource(ints = {25, 40})
    void rejectsOverTwentyFourCharacters(int length) {
        assertThat(UsernameValidator.problem("a".repeat(length))).isEqualTo(TOO_LONG);
    }

    @ParameterizedTest
    @ValueSource(strings = {"é", "Zoé"})
    void reportsForbiddenCharactersBeforeLength(String value) {
        assertThat(UsernameValidator.problem(value)).startsWith("Caractère non autorisé : é");
    }
}
