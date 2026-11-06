package fr.tikigaming.games.mini_gta.features;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.TikiGamingApplication;
import io.cucumber.java.AfterAll;
import io.cucumber.java.Before;
import io.cucumber.java.BeforeAll;
import io.cucumber.java.ParameterType;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Client HTTP de l'API MiniGTA. L'application réelle (sécurité, CSRF, validation, ville de production) est démarrée
 * une fois pour la suite, sur un port libre ; les étapes l'appellent comme le ferait le front. La dernière réponse
 * est gardée pour les étapes « Alors » et remise à zéro avant chaque scénario.
 *
 * <p>Sans {@code cucumber-spring} : ce module imposerait une configuration Spring à toutes les suites Cucumber du
 * backend, y compris celles des autres jeux qui n'en ont pas besoin.
 */
public class MiniGtaApi {

    static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String XSRF = "jeton-de-test";

    private static ConfigurableApplicationContext app;
    private static String base;
    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static int status;
    private static JsonNode body;

    @BeforeAll
    public static void startApplication() {
        // Arguments de ligne de commande : ils priment sur backend/.env, comme les propriétés de @SpringBootTest.
        app = new SpringApplicationBuilder(TikiGamingApplication.class)
                .run(
                        "--server.port=0",
                        // Valeurs factices : aucun appel externe n'est fait par ces endpoints.
                        "--GOOGLE_CLIENT_ID=test-client-id",
                        "--GOOGLE_CLIENT_SECRET=test-client-secret",
                        "--SUPABASE_URL=https://test.supabase.co",
                        "--SUPABASE_ANON_KEY=test-anon-key",
                        "--SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
                        "--SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters");
        base = "http://localhost:" + app.getEnvironment().getProperty("local.server.port") + "/api/games/mini-gta";
    }

    @AfterAll
    public static void stopApplication() {
        if (app != null) app.close();
    }

    @Before
    public void forgetLastResponse() {
        status = 0;
        body = null;
    }

    static JsonNode get(String path) {
        return send(HttpRequest.newBuilder(URI.create(base + path)).GET());
    }

    /** POST tel que l'envoie le front : cookie XSRF-TOKEN recopié dans l'en-tête X-XSRF-TOKEN. */
    static JsonNode post(String path, Object payload) {
        return send(HttpRequest.newBuilder(URI.create(base + path))
                .header("Cookie", "XSRF-TOKEN=" + XSRF)
                .header("X-XSRF-TOKEN", XSRF)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(payload))));
    }

    private static JsonNode send(HttpRequest.Builder request) {
        try {
            HttpResponse<String> response = HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
            status = response.statusCode();
            body = response.body().isEmpty() ? null : JSON.readTree(response.body());
            return body;
        } catch (IOException e) {
            throw new IllegalStateException("Requête impossible : " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Requête interrompue", e);
        }
    }

    static boolean succeeded() {
        return status == 200;
    }

    /** Montant en dollars, écrit comme dans le jeu : « 500 $ ». */
    @ParameterType(name = "montant", value = "(\\d+) \\$")
    public int montant(String dollars) {
        try {
            return Integer.parseInt(dollars);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Montant invalide dans le scénario : " + dollars, e);
        }
    }

    /**
     * Le gestionnaire d'erreurs de la plateforme donne le même message à toute requête refusée par le contrôleur
     * (« Requête invalide. ») : seul le code distingue une mission introuvable d'une saisie invalide.
     */
    static void assertRefused(int code) {
        assertThat(status).isEqualTo(code);
        assertThat(body.get("error").asString()).isEqualTo("Requête invalide.");
    }
}
