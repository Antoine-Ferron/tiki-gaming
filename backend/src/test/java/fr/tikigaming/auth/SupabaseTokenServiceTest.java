package fr.tikigaming.auth;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.config.TikiProperties;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

class SupabaseTokenServiceTest {

    private static final String SECRET = "super-secret-jwt-token-with-at-least-32-characters";

    @Test
    void issuesTokenVerifiableWithProjectSecretAndRecognisedByRls() {
        TikiProperties props = new TikiProperties("http://localhost:5173",
            new TikiProperties.Supabase("https://ref.supabase.co", "anon", "service", SECRET, Duration.ofHours(1)));
        AuthUser user = new AuthUser("7d0e3c1a-0000-4000-8000-000000000001", "joueur@example.com");

        SupabaseTokenService.IssuedToken token = new SupabaseTokenService(props).issue(user);

        Jwt jwt = NimbusJwtDecoder
            .withSecretKey(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
            .build()
            .decode(token.value());
        assertThat(jwt.getSubject()).isEqualTo(user.id());
        assertThat(jwt.getClaimAsString("role")).isEqualTo("authenticated");
        assertThat(jwt.getAudience()).containsExactly("authenticated");
        assertThat(jwt.getIssuer().toString()).isEqualTo("https://ref.supabase.co/auth/v1");
        assertThat(jwt.getExpiresAt()).isEqualTo(token.expiresAt().truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
    }

    @Test
    void rejectsExternalRedirects() {
        assertThat(AuthSession.safeRedirect("/games/clicker")).isEqualTo("/games/clicker");
        assertThat(AuthSession.safeRedirect("https://evil.example")).isEqualTo("/");
        assertThat(AuthSession.safeRedirect("//evil.example")).isEqualTo("/");
        assertThat(AuthSession.safeRedirect("/\\evil.example")).isEqualTo("/");
        assertThat(AuthSession.safeRedirect(null)).isEqualTo("/");
    }
}
