package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.node.JsonNodeFactory;

class PrismineScoreValidatorTest {

    private final PrismineScoreValidator validator = new PrismineScoreValidator();

    @Test
    void refusesEveryScoreSentByAPlayer() {
        assertThat(validator.gameSlug()).isEqualTo("prismine");
        assertThatThrownBy(() -> validator.validate(
                        new AuthUser("u-1", "joueur@example.com"), 150, JsonNodeFactory.instance.objectNode()))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(e.getMessage()).isEqualTo(PrismineScoreValidator.SERVER_SCORED);
                });
    }
}
