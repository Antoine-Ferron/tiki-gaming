package fr.tikigaming.games.prismine;

import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiException;
import fr.tikigaming.scores.ScoreValidator;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Refuse tout score Prismine envoyé par un joueur sur {@code POST /api/scores} : le serveur arbitre l'expédition et
 * classe lui-même son score à la fin (voir {@link ScoreRegistry}), le joueur ne peut pas en déclarer un.
 */
@Component
class PrismineScoreValidator implements ScoreValidator {

    static final String SERVER_SCORED = "Le score de Prismine est enregistré à la fin de l'expédition.";

    @Override
    public String gameSlug() {
        return "prismine";
    }

    @Override
    public void validate(AuthUser player, long score, JsonNode metadata) {
        throw new ApiException(HttpStatus.FORBIDDEN, SERVER_SCORED);
    }
}
