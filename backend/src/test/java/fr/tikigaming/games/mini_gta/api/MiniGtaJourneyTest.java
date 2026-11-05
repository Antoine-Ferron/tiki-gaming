package fr.tikigaming.games.mini_gta.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Parcours d'un invité sur l'application réelle (sécurité, CSRF, validation, ville de production) : charger la
 * ville, réussir une mission, dépenser, réapparaître, en renvoyant à chaque fois la progression reçue.
 */
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
@DisplayName("MiniGTA : parcours d'un invité de bout en bout")
class MiniGtaJourneyTest {

    private static final String XSRF = "jeton-de-test";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired
    MockMvc mvc;

    /** POST tel que l'envoie le front : cookie XSRF-TOKEN recopié dans l'en-tête X-XSRF-TOKEN. */
    private static MockHttpServletRequestBuilder postJson(String path, String json) {
        return post(path)
                .cookie(new Cookie("XSRF-TOKEN", XSRF))
                .header("X-XSRF-TOKEN", XSRF)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json);
    }

    private JsonNode read(MockHttpServletRequestBuilder request) throws Exception {
        String body = mvc.perform(request)
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JSON.readTree(body);
    }

    @Test
    void unInviteChargeLaVilleEtSesMissionsSansSession() throws Exception {
        mvc.perform(get("/api/games/mini-gta/world"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seed").value(MiniGtaWorld.SEED))
                .andExpect(jsonPath("$.locations.missionGivers.length()").value(4));
        mvc.perform(get("/api/games/mini-gta/missions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("express"));
        mvc.perform(get("/api/games/mini-gta/weapons")).andExpect(status().isOk());
    }

    @Test
    void unPostSansJetonCsrfEstRefuse() throws Exception {
        mvc.perform(post("/api/games/mini-gta/respawn")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void missionAchatPuisReapparitionEnChainantLaProgression() throws Exception {
        String progress = MiniGtaControllerTest.NEW_GAME;

        JsonNode reward =
                read(postJson("/api/games/mini-gta/missions/special/complete", "{\"progress\": " + progress + "}"));
        assertThat(reward.get("rewarded").asBoolean()).isTrue();
        progress = reward.get("progress").toString();

        JsonNode purchase = read(postJson(
                "/api/games/mini-gta/shop/purchase",
                "{\"progress\": " + progress + ", \"item\": \"weapon\", \"weapon\": \"shotgun\"}"));
        assertThat(purchase.get("ok").asBoolean()).isTrue();
        progress = purchase.get("progress").toString();

        JsonNode respawn =
                read(postJson("/api/games/mini-gta/respawn", "{\"progress\": " + progress + ", \"reason\": \"dead\"}"));
        JsonNode last = respawn.get("progress");

        // 500 de départ + 3000 de récompense - 1200 pour le fusil - 230 de frais (10 % de 2300).
        assertThat(respawn.get("fee").asInt()).isEqualTo(230);
        assertThat(last.get("money").asInt()).isEqualTo(2070);
        assertThat(last.get("totalEarned").asInt()).isEqualTo(3000);
        assertThat(last.get("completedMissions").get(0).asString()).isEqualTo("special");

        JsonNode again =
                read(postJson("/api/games/mini-gta/missions/special/complete", "{\"progress\": " + last + "}"));
        assertThat(again.get("rewarded").asBoolean()).isFalse();
        assertThat(again.get("progress").get("money").asInt()).isEqualTo(2070);
    }
}
