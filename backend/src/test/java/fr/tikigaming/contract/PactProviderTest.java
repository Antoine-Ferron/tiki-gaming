package fr.tikigaming.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import au.com.dius.pact.provider.junit5.HttpTestTarget;
import au.com.dius.pact.provider.junit5.PactVerificationContext;
import au.com.dius.pact.provider.junit5.PactVerificationInvocationContextProvider;
import au.com.dius.pact.provider.junitsupport.Provider;
import au.com.dius.pact.provider.junitsupport.State;
import au.com.dius.pact.provider.junitsupport.loader.PactFolder;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.auth.SupabaseAuthClient;
import fr.tikigaming.config.ApiException;
import fr.tikigaming.scores.SupabaseScoresClient;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.apache.hc.core5.http.ClassicHttpRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestTemplate;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Vérification fournisseur du contrat Pact écrit par le front (frontend/pacts, tests/contract). Chaque interaction
 * est rejouée en HTTP contre l'application Spring complète (sécurité, CSRF, validation, sérialisation) ; seuls les
 * appels à Supabase sont simulés. Un champ renommé ou un statut changé côté backend fait échouer ce test.
 */
@Provider("tiki-backend")
@PactFolder("../frontend/pacts")
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
class PactProviderTest {

    private static final AuthUser PLAYER = new AuthUser("7c9e6679-7425-40de-944b-e07fc1f90ae7", "joueur@example.com");
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    @LocalServerPort
    private int port;

    @MockitoBean
    private SupabaseAuthClient supabaseAuth;

    @MockitoBean
    private SupabaseScoresClient supabaseScores;

    /** Cookies de la session ouverte par l'état du contrat, et jeton CSRF qui va avec. */
    private final Map<String, String> cookies = new LinkedHashMap<>();

    @BeforeEach
    void target(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", port));
    }

    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verifieLeContratDuFront(PactVerificationContext context, ClassicHttpRequest request) {
        // Le contrat porte un jeton CSRF d'exemple : on envoie celui de la session ouverte par l'état.
        request.setHeader(
                "Cookie",
                cookies.entrySet().stream()
                        .map(c -> c.getKey() + "=" + c.getValue())
                        .collect(Collectors.joining("; ")));
        if (request.containsHeader("X-XSRF-TOKEN")) request.setHeader("X-XSRF-TOKEN", cookies.get("XSRF-TOKEN"));
        context.verifyInteraction();
    }

    @State("aucun joueur n’est connecté")
    void aGuest() throws Exception {
        send(HttpRequest.newBuilder(url("/api/auth/session")).GET());
    }

    @State("un joueur est connecté")
    void aSignedInPlayer() throws Exception {
        when(supabaseAuth.signInWithPassword(anyString(), anyString())).thenReturn(PLAYER);
        // Refus que la base oppose à un score au-dessus du maximum du Clicker (300), traduit par le client.
        doThrow(new ApiException(HttpStatus.BAD_REQUEST, "Score refusé : il dépasse le maximum de ce jeu."))
                .when(supabaseScores)
                .insert(eq(PLAYER.id()), eq("clicker"), eq(301L), any());

        send(HttpRequest.newBuilder(url("/api/auth/session")).GET());
        HttpResponse<String> login = send(HttpRequest.newBuilder(url("/api/auth/login"))
                .header("Content-Type", "application/json")
                .header("X-XSRF-TOKEN", cookies.get("XSRF-TOKEN"))
                .POST(HttpRequest.BodyPublishers.ofString("""
                        {"email": "joueur@example.com", "password": "motdepasse-de-test"}""")));
        assertThat(login.statusCode()).as("connexion de l'état du contrat").isEqualTo(204);
    }

    private URI url(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    /** Envoie la requête avec les cookies connus, puis retient ceux que le backend pose. */
    private HttpResponse<String> send(HttpRequest.Builder request) throws IOException, InterruptedException {
        if (!cookies.isEmpty()) {
            request.header(
                    "Cookie",
                    cookies.entrySet().stream()
                            .map(c -> c.getKey() + "=" + c.getValue())
                            .collect(Collectors.joining("; ")));
        }
        HttpResponse<String> response = HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
        for (String header : response.headers().allValues("Set-Cookie")) {
            String[] pair = header.split(";", 2)[0].split("=", 2);
            cookies.put(pair[0], pair[1]);
        }
        return response;
    }
}
