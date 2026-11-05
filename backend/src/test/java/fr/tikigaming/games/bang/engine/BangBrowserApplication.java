package fr.tikigaming.games.bang.engine;

import fr.tikigaming.TikiGamingApplication;
import fr.tikigaming.auth.AuthException;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.games.bang.cards.BangCharacter;
import fr.tikigaming.games.bang.model.CardInstance;
import java.util.Collections;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Serveur Playwright : backend BANG! réel, mélange contrôlé, frontière Supabase locale. Jamais empaqueté. */
public final class BangBrowserApplication {
    private BangBrowserApplication() {}

    public static void main(String[] args) {
        new SpringApplication(TikiGamingApplication.class, Fixtures.class)
                .run(
                        "--spring.config.import=",
                        "--spring.profiles.active=bang-browser",
                        "--server.address=127.0.0.1",
                        "--server.port=18080",
                        "--GOOGLE_CLIENT_ID=bang-browser-client",
                        "--GOOGLE_CLIENT_SECRET=bang-browser-secret",
                        "--SUPABASE_URL=http://localhost:18080/api/test-supabase",
                        "--SUPABASE_ANON_KEY=bang-browser-anon",
                        "--SUPABASE_SERVICE_ROLE_KEY=bang-browser-service",
                        "--SUPABASE_JWT_SECRET=bang-browser-test-secret-with-at-least-32-characters",
                        "--COOKIE_SECURE=false");
    }

    @TestConfiguration
    @Profile("bang-browser")
    @Import(SupabaseFixture.class)
    static class Fixtures {
        @Bean
        @Order(0)
        SecurityFilterChain supabaseFixtureSecurity(HttpSecurity http) throws Exception {
            return http.securityMatcher("/api/test-supabase/**")
                    .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                    .csrf(AbstractHttpConfigurer::disable)
                    .build();
        }

        @Bean
        @Primary
        InitialDeal browserDeal(GameCatalog catalog) {
            return new InitialDeal(catalog, items -> {
                if (items.getFirst() instanceof CardInstance) Collections.rotate(items, -20);
                if (items.getFirst() instanceof BangCharacter) Collections.rotate(items, 1);
            });
        }
    }

    /** Sept créateurs de tables indépendantes : connexion par AuthController et sessions/CSRF réels. */
    @RestController
    @Profile("bang-browser")
    @RequestMapping("/api/test-supabase")
    static class SupabaseFixture {
        @PostMapping("/auth/v1/token")
        Map<String, AuthUser> login(@RequestBody Map<String, String> credentials) {
            for (int seat = 1; seat <= 7; seat++) {
                if (("bang" + seat + "@example.test").equals(credentials.get("email"))
                        && "bang-browser-test-only".equals(credentials.get("password"))) {
                    return Map.of("user", new AuthUser(accountId(seat), credentials.get("email")));
                }
            }
            throw new AuthException(400, "Compte de test inconnu.");
        }

        @GetMapping("/rest/v1/profiles")
        Map<String, Object> profile(@RequestParam String id) {
            for (int seat = 1; seat <= 7; seat++) {
                if (("eq." + accountId(seat)).equals(id)) {
                    return Map.of("id", accountId(seat), "username", "bang_test_" + seat);
                }
            }
            throw new AuthException(404, "Profil de test inconnu.");
        }

        private static String accountId(int seat) {
            return "00000000-0000-4000-8000-00000000000" + seat;
        }
    }
}
