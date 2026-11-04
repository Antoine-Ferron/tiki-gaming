package fr.tikigaming.games.mastermind;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
        properties = {
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@AutoConfigureMockMvc
class MastermindApiIntegrationTest {
    private static final String XSRF = "mastermind-integration-test";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired
    private MockMvc mvc;

    @Test
    void createsAndLoadsGameWithoutExposingSecret() throws Exception {
        JsonNode created = read(postJson("/api/games/mastermind", ""));

        mvc.perform(get("/api/games/mastermind/{id}", created.get("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(created.get("id").asText()))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.attemptsUsed").value(0))
                .andExpect(jsonPath("$.attemptsRemaining").value(10))
                .andExpect(jsonPath("$.secret").doesNotExist());
    }

    @Test
    void validatesGuessThroughControllerServiceAndGame() throws Exception {
        JsonNode created = read(postJson("/api/games/mastermind", ""));
        String id = created.get("id").asText();

        mvc.perform(postJson(
                        "/api/games/mastermind/{id}/guesses".replace("{id}", id),
                        """
                        {"colors":["red","blue","green"]}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("exactement 4")));

        mvc.perform(postJson(
                        "/api/games/mastermind/{id}/guesses".replace("{id}", id),
                        """
                        {"colors":["red","red","red","red"]}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.attemptsUsed").value(1))
                .andExpect(jsonPath("$.attemptsRemaining").value(9))
                .andExpect(jsonPath("$.history.length()").value(1));
    }

    @Test
    void restartsGameAndReturnsNotFoundForUnknownGame() throws Exception {
        JsonNode created = read(postJson("/api/games/mastermind", ""));
        String id = created.get("id").asText();

        mvc.perform(postJson("/api/games/mastermind/" + id + "/restart", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.attemptsUsed").value(0))
                .andExpect(jsonPath("$.attemptsRemaining").value(10))
                .andExpect(jsonPath("$.secret").doesNotExist());

        mvc.perform(get("/api/games/mastermind/{id}", "00000000-0000-4000-8000-000000000000"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Partie introuvable."));
    }

    private JsonNode read(MockHttpServletRequestBuilder request) throws Exception {
        String body = mvc.perform(request)
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JSON.readTree(body);
    }

    private static MockHttpServletRequestBuilder postJson(String path, String json) {
        return post(path)
                .cookie(new Cookie("XSRF-TOKEN", XSRF))
                .header("X-XSRF-TOKEN", XSRF)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json);
    }
}
