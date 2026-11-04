package fr.tikigaming.games.bang.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
        properties = {
            "spring.config.import=",
            "spring.application.name=bang-capacity-http-test",
            "GOOGLE_CLIENT_ID=test-client-id",
            "GOOGLE_CLIENT_SECRET=test-client-secret",
            "SUPABASE_URL=https://test.supabase.co",
            "SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "SUPABASE_JWT_SECRET=test-jwt-secret-with-at-least-32-characters"
        })
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PrivateTableCapacityHttpTest {

    private static final String TABLES = "/api/games/bang/tables";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Test
    void theThousandAndFirstTableIsRefusedButExistingTablesRemainJoinable() throws Exception {
        Cookie csrf = mvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        String first = postAs(TABLES, "creator-0", csrf)
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String code = json.readTree(first).get("code").asString();
        for (int account = 1; account < 1000; account++) {
            postAs(TABLES, "creator-" + account, csrf).andExpect(status().isCreated());
        }

        postAs(TABLES, "one-too-many", csrf)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("Le serveur a atteint sa limite de tables privées."));
        postAs(TABLES + "/" + code + "/join", "creator-0", csrf)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(1));
        postAs(TABLES + "/" + code + "/join", "joining-player", csrf)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seat").value(2));
    }

    private ResultActions postAs(String path, String accountId, Cookie csrf) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AuthSession.signIn(request, new AuthUser(accountId, accountId + "@example.com"));
        return mvc.perform(post(path)
                .session((MockHttpSession) request.getSession())
                .cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue()));
    }
}
