package fr.tikigaming.games.sdv_civilisation.api;

import fr.tikigaming.config.TikiProperties;
import fr.tikigaming.games.sdv_civilisation.Tables;
import java.time.Duration;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** Données partagées par les tests de l'API : configuration factice et partie enregistrée type. */
final class Fixtures {

    static final String SUPABASE_URL = "https://ref.supabase.co";
    static final String SERVICE_KEY = "service-role-key";
    static final String JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters";
    static final ObjectMapper JSON = JsonMapper.builder().build();

    private Fixtures() {}

    static TikiProperties props(String jwtSecret) {
        return new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(SUPABASE_URL, "anon-key", SERVICE_KEY, jwtSecret, Duration.ofHours(1)));
    }

    static SavedGame saved(int version) {
        return new SavedGame(version, 61_000, Tables.start("Citadelle d’Orkan"));
    }
}
