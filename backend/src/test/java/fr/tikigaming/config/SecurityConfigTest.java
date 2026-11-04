package fr.tikigaming.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.auth.SupabaseAuthClient;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Chaîne de sécurité réelle (CSRF, OAuth2 Google, session) ; seul Supabase est simulé. */
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
class SecurityConfigTest {

    private static final String LOGIN = """
            {"email": "joueur@example.com", "password": "secret-123"}""";

    @Autowired
    MockMvc mvc;

    @MockitoBean
    SupabaseAuthClient supabase;

    /** Le jeton CSRF que le front lit dans le cookie XSRF-TOKEN, posé par GET /api/auth/session. */
    private Cookie csrfCookie(MockHttpSession session) throws Exception {
        Cookie cookie = mvc.perform(get("/api/auth/session").session(session))
                .andReturn()
                .getResponse()
                .getCookie("XSRF-TOKEN");
        assertThat(cookie).as("cookie XSRF-TOKEN").isNotNull();
        assertThat(cookie.isHttpOnly()).as("lisible par le front").isFalse();
        return cookie;
    }

    @Test
    void postWithoutCsrfTokenIsForbidden() throws Exception {
        mvc.perform(post("/api/auth/logout")).andExpect(status().isForbidden());
    }

    @Test
    void deletingTheAccountWithoutCsrfTokenIsForbidden() throws Exception {
        // Un site tiers ne doit pas pouvoir supprimer le compte d'un joueur connecté.
        mvc.perform(delete("/api/auth/account")).andExpect(status().isForbidden());
        verifyNoInteractions(supabase);
    }

    @Test
    void postWithAWrongCsrfTokenIsForbidden() throws Exception {
        MockHttpSession session = new MockHttpSession();
        Cookie cookie = csrfCookie(session);

        mvc.perform(post("/api/auth/logout").session(session).cookie(cookie).header("X-XSRF-TOKEN", "faux"))
                .andExpect(status().isForbidden());
    }

    @Test
    void postWithTheCookieCopiedInTheHeaderIsAccepted() throws Exception {
        MockHttpSession session = new MockHttpSession();
        Cookie cookie = csrfCookie(session);

        mvc.perform(post("/api/auth/logout").session(session).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue()))
                .andExpect(status().isNoContent());
    }

    @Test
    void loginThenSessionThenLogout() throws Exception {
        when(supabase.signInWithPassword("joueur@example.com", "secret-123"))
                .thenReturn(new AuthUser("u-1", "joueur@example.com"));
        MockHttpSession session = new MockHttpSession();
        Cookie cookie = csrfCookie(session);

        MvcResult login = mvc.perform(post("/api/auth/login")
                        .session(session)
                        .cookie(cookie)
                        .header("X-XSRF-TOKEN", cookie.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LOGIN))
                .andExpect(status().isNoContent())
                .andReturn();
        MockHttpSession signedIn = (MockHttpSession) login.getRequest().getSession(false);

        mvc.perform(get("/api/auth/session").session(signedIn))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value("u-1"))
                .andExpect(jsonPath("$.accessToken").isString());

        mvc.perform(post("/api/auth/logout").session(signedIn).cookie(cookie).header("X-XSRF-TOKEN", cookie.getValue()))
                .andExpect(status().isNoContent());
        assertThat(signedIn.isInvalid()).isTrue();
    }

    @Test
    void googleAuthorizationRedirectsToGoogleWithTheFrontCallback() throws Exception {
        String location = mvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().isFound())
                .andReturn()
                .getResponse()
                .getRedirectedUrl();

        assertThat(location)
                .startsWith("https://accounts.google.com/o/oauth2/v2/auth")
                .contains("client_id=test-client-id")
                .contains("redirect_uri=http://localhost:5173/login/oauth2/code/google")
                .contains("scope=openid%20email%20profile")
                .contains("state=");
    }

    @Test
    void sessionEndpointIsPublicForGuests() throws Exception {
        mvc.perform(get("/api/auth/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user").isEmpty());
    }
}
