package fr.tikigaming.config;

import static org.hamcrest.Matchers.aMapWithSize;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

class OpenApiDocsTest {

    // Valeurs factices : la CI n'a pas de backend/.env et aucun appel externe n'est fait au démarrage.
    static final String GOOGLE_CLIENT_ID = "GOOGLE_CLIENT_ID=test-client-id";
    static final String GOOGLE_CLIENT_SECRET = "GOOGLE_CLIENT_SECRET=test-client-secret";
    static final String SUPABASE_URL = "SUPABASE_URL=https://test.supabase.co";
    static final String SUPABASE_ANON_KEY = "SUPABASE_ANON_KEY=test-anon-key";
    static final String SUPABASE_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key";
    static final String SUPABASE_JWT_SECRET = "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters";

    @Nested
    @SpringBootTest(
            properties = {
                GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET,
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
                SUPABASE_SERVICE_ROLE_KEY,
                SUPABASE_JWT_SECRET
            })
    @AutoConfigureMockMvc
    class Enabled {

        @Autowired
        MockMvc mvc;

        @Test
        void exposesEveryEndpointWithASummary() throws Exception {
            mvc.perform(get("/v3/api-docs"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.info.title").value("Tiki Gaming API"))
                    .andExpect(jsonPath("$.paths", aMapWithSize(32)))
                    .andExpect(jsonPath("$.paths['/api/auth/session'].get.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/auth/google'].get.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/auth/login'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/auth/signup'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/auth/password/forgot'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/auth/password/reset'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/auth/password'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/auth/logout'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/scores'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths", hasKey("/api/games/mastermind")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/games/mastermind/{id}")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/games/mastermind/{id}/guesses")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/games/mastermind/{id}/restart")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/games/bang/tables")))
                    .andExpect(jsonPath("$.paths", hasKey("/api/games/bang/tables/{code}/join")))
                    .andExpect(jsonPath(
                            "$.paths['/api/games/rush-hour/levels/{level}/results'].post.summary",
                            not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/games/mini-gta/world'].get.summary", not(emptyOrNullString())))
                    .andExpect(
                            jsonPath("$.paths['/api/games/mini-gta/missions'].get.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/games/mini-gta/weapons'].get.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/games/mini-gta/route'].get.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath(
                            "$.paths['/api/games/mini-gta/missions/{id}/complete'].post.summary",
                            not(emptyOrNullString())))
                    .andExpect(jsonPath(
                            "$.paths['/api/games/mini-gta/shop/purchase'].post.summary", not(emptyOrNullString())))
                    .andExpect(
                            jsonPath("$.paths['/api/games/mini-gta/respawn'].post.summary", not(emptyOrNullString())))
                    // Chaque endpoint porte le tag de son contrôleur : la plateforme ou le slug du jeu.
                    .andExpect(jsonPath(
                            "$.paths.*.*.tags[*]",
                            everyItem(anyOf(
                                    containsString("Authentification"),
                                    containsString("Scores"),
                                    containsString("mastermind"),
                                    containsString("bang"),
                                    containsString("sudoku"),
                                    containsString("mini-gta"),
                                    containsString("SDV Civilisation"),
                                    containsString("rush-hour")))))
                    .andExpect(jsonPath(
                            "$.paths['/api/games/sdv-civilisation/games/current/turns'].post.summary",
                            not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/games/sudoku/puzzle'].get.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/games/sudoku/check'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/games/sudoku/{gameId}'].get.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath(
                            "$.paths['/api/games/sudoku/{gameId}/moves'].post.summary", not(emptyOrNullString())))
                    .andExpect(jsonPath("$.paths['/api/games/sudoku/puzzle'].get.tags[*]", hasItem("sudoku")))
                    .andExpect(jsonPath("$.paths['/api/games/sudoku/check'].post.tags[*]", hasItem("sudoku")));
        }

        @Test
        void hidesServletAndCsrfParameters() throws Exception {
            mvc.perform(get("/v3/api-docs"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.paths['/api/auth/session'].get.parameters")
                            .doesNotExist())
                    .andExpect(jsonPath("$.paths['/api/auth/google'].get.parameters[*].name", hasItem("redirect")))
                    .andExpect(
                            jsonPath("$.paths['/api/auth/google'].get.parameters", org.hamcrest.Matchers.hasSize(1)));
        }

        @Test
        void servesSwaggerUiWithCsrfSupport() throws Exception {
            mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
            mvc.perform(get("/swagger-ui/swagger-initializer.js"))
                    .andExpect(status().isOk())
                    .andExpect(content().string(containsString("XSRF-TOKEN")));
        }
    }

    @Nested
    @SpringBootTest(
            properties = {
                GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET,
                SUPABASE_URL,
                SUPABASE_ANON_KEY,
                SUPABASE_SERVICE_ROLE_KEY,
                SUPABASE_JWT_SECRET,
                "SWAGGER_ENABLED=false"
            })
    @AutoConfigureMockMvc
    class Disabled {

        @Autowired
        MockMvc mvc;

        @Test
        void hidesDocumentationWhenDisabled() throws Exception {
            mvc.perform(get("/v3/api-docs")).andExpect(status().isNotFound());
            mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isNotFound());
        }
    }
}
