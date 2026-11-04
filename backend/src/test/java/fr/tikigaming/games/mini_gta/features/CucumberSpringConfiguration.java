package fr.tikigaming.games.mini_gta.features;

import io.cucumber.spring.CucumberContextConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

/**
 * Les scénarios tournent sur l'application réelle (sécurité, CSRF, validation, ville de production), comme
 * {@code MiniGtaJourneyTest} : les étapes appellent l'API, jamais les classes du contrôleur.
 */
@CucumberContextConfiguration
@SpringBootTest(
        properties = {
            // Valeurs factices : aucun appel externe n'est fait par ces endpoints.
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@AutoConfigureMockMvc
public class CucumberSpringConfiguration {}
