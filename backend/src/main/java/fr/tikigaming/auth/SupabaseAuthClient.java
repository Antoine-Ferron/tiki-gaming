package fr.tikigaming.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.tikigaming.config.TikiProperties;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Appels à l'API Auth (GoTrue) et PostgREST de Supabase, côté serveur uniquement. */
@Component
public class SupabaseAuthClient {

    public record SignUpResult(AuthUser user, boolean signedIn) {}

    private final RestClient rest;
    private final TikiProperties.Supabase cfg;

    public SupabaseAuthClient(RestClient.Builder builder, TikiProperties props, ObjectMapper mapper) {
        this.cfg = props.supabase();
        this.rest = builder.baseUrl(cfg.url())
                .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> {
                    throw new AuthException(res.getStatusCode().value(), errorMessage(mapper, res.getBody()));
                })
                .build();
    }

    public AuthUser signInWithPassword(String email, String password) {
        JsonNode body = rest.post()
                .uri(b -> b.path("/auth/v1/token")
                        .queryParam("grant_type", "password")
                        .build())
                .headers(this::anon)
                .body(Map.of("email", email, "password", password))
                .retrieve()
                .body(JsonNode.class);
        return toUser(body.get("user"));
    }

    public SignUpResult signUp(String email, String password, String username, String redirectTo) {
        JsonNode body = rest.post()
                .uri(b -> b.path("/auth/v1/signup")
                        .queryParam("redirect_to", redirectTo)
                        .build())
                .headers(this::anon)
                // data.username est lu par le trigger handle_new_user pour créer le profil.
                .body(Map.of("email", email, "password", password, "data", Map.of("username", username)))
                .retrieve()
                .body(JsonNode.class);
        // Sans confirmation email, GoTrue renvoie une session ; sinon, l'utilisateur seul.
        return body.has("access_token")
                ? new SignUpResult(toUser(body.get("user")), true)
                : new SignUpResult(toUser(body), false);
    }

    public void sendPasswordRecovery(String email, String redirectTo) {
        rest.post()
                .uri(b -> b.path("/auth/v1/recover")
                        .queryParam("redirect_to", redirectTo)
                        .build())
                .headers(this::anon)
                .body(Map.of("email", email))
                .retrieve()
                .toBodilessEntity();
    }

    /** Applique un nouveau mot de passe avec le jeton reçu dans le lien de réinitialisation. */
    public AuthUser updatePasswordWithRecoveryToken(String recoveryToken, String password) {
        JsonNode body = rest.put()
                .uri("/auth/v1/user")
                .headers(h -> {
                    anon(h);
                    h.setBearerAuth(recoveryToken);
                })
                .body(Map.of("password", password))
                .retrieve()
                .body(JsonNode.class);
        return toUser(body);
    }

    public void updatePassword(String userId, String password) {
        rest.put()
                .uri("/auth/v1/admin/users/{id}", userId)
                .headers(this::admin)
                .body(Map.of("password", password))
                .retrieve()
                .toBodilessEntity();
    }

    /** Retrouve le compte Supabase associé à l'email (vérifié par Google), ou le crée. */
    public AuthUser findOrCreateUser(String email, String displayName) {
        String existingId = findUserId(email);
        if (existingId != null) return new AuthUser(existingId, email);
        try {
            JsonNode created = rest.post()
                    .uri("/auth/v1/admin/users")
                    .headers(this::admin)
                    .body(Map.of(
                            "email",
                            email,
                            "email_confirm",
                            true,
                            "user_metadata",
                            Map.of("username", displayName == null ? "" : displayName)))
                    .retrieve()
                    .body(JsonNode.class);
            return toUser(created);
        } catch (AuthException e) {
            // Création concurrente du même compte : on relit.
            String id = findUserId(email);
            if (id == null) throw e;
            return new AuthUser(id, email);
        }
    }

    private String findUserId(String email) {
        JsonNode id = rest.post()
                .uri("/rest/v1/rpc/find_auth_user_id")
                .headers(this::admin)
                .body(Map.of("p_email", email))
                .retrieve()
                .body(JsonNode.class);
        return id == null || id.isNull() ? null : id.asText();
    }

    private void anon(HttpHeaders h) {
        h.set("apikey", cfg.anonKey());
    }

    private void admin(HttpHeaders h) {
        h.set("apikey", cfg.serviceRoleKey());
        h.setBearerAuth(cfg.serviceRoleKey());
    }

    private static AuthUser toUser(JsonNode user) {
        return new AuthUser(user.get("id").asText(), user.path("email").asText(null));
    }

    private static String errorMessage(ObjectMapper mapper, java.io.InputStream body) {
        try {
            JsonNode json = mapper.readTree(body);
            if (json == null) return SupabaseErrors.DEFAULT_MESSAGE;
            // Selon la version de GoTrue, le code est dans error_code, ou dans code (sinon code = statut HTTP).
            String code = json.hasNonNull("error_code")
                    ? json.get("error_code").asText()
                    : json.path("code").isTextual() ? json.get("code").asText() : null;
            for (String field : List.of("msg", "error_description", "message", "error")) {
                if (json.hasNonNull(field)) {
                    return SupabaseErrors.message(code, json.get(field).asText());
                }
            }
            return SupabaseErrors.message(code, null);
        } catch (IOException ignored) {
            // corps non JSON : message générique
            return SupabaseErrors.DEFAULT_MESSAGE;
        }
    }
}
