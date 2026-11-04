package fr.tikigaming.scores;

import fr.tikigaming.auth.AuthUser;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

/** Enregistre le score d'un joueur connecté, après la vérification propre au jeu s'il en a une. */
@Service
public class ScoreService {

    private final SupabaseScoresClient scores;
    private final Map<String, ScoreValidator> validators;

    public ScoreService(SupabaseScoresClient scores, List<ScoreValidator> validators) {
        this.scores = scores;
        // Deux validateurs pour un même jeu : erreur au démarrage plutôt qu'un choix arbitraire.
        this.validators = validators.stream().collect(Collectors.toMap(ScoreValidator::gameSlug, Function.identity()));
    }

    public void submit(AuthUser player, String gameSlug, long score, JsonNode metadata) {
        ScoreValidator validator = validators.get(gameSlug);
        if (validator != null) validator.validate(player, score, metadata);
        scores.insert(player.id(), gameSlug, score, metadata);
    }
}
