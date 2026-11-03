package fr.tikigaming.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.config.ApiExceptionHandler;
import fr.tikigaming.config.TikiProperties;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.security.web.method.annotation.CsrfTokenArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** Endpoints /api/auth/* et état de la session HTTP. La sécurité (CSRF, OAuth2) est testée par SecurityConfigTest. */
class AuthControllerTest {

    private static final String SECRET = "super-secret-jwt-token-with-at-least-32-characters";
    private static final AuthUser PLAYER = new AuthUser("u-1", "joueur@example.com");

    private final SupabaseAuthClient supabase = mock(SupabaseAuthClient.class);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase("https://ref.supabase.co", "anon", "service", SECRET, Duration.ofHours(1)));
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(supabase, new SupabaseTokenService(props), props))
                .setControllerAdvice(new ApiExceptionHandler())
                // En application, Spring Security fournit le jeton CSRF au contrôleur.
                .setCustomArgumentResolvers(new CsrfTokenArgumentResolver())
                .defaultResponseCharacterEncoding(StandardCharsets.UTF_8)
                .build();
    }

    private static MockHttpServletRequestBuilder postJson(String path, String json) {
        return post(path).contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private static MockHttpSession signedInSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthSession.USER, PLAYER);
        return session;
    }

    private static MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder request) {
        return request.requestAttr(CsrfToken.class.getName(), new DefaultCsrfToken("X-XSRF-TOKEN", "_csrf", "t"));
    }

    @Test
    void sessionOfAGuestHasNoUserAndNoToken() throws Exception {
        mvc.perform(withCsrf(get("/api/auth/session")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user").isEmpty())
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.expiresAt").doesNotExist());
    }

    @Test
    void sessionOfAPlayerReturnsTheUserAndASupabaseTokenValidForOneHour() throws Exception {
        long before = System.currentTimeMillis();

        mvc.perform(withCsrf(get("/api/auth/session")).session(signedInSession()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value("u-1"))
                .andExpect(jsonPath("$.user.email").value("joueur@example.com"))
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(result -> {
                    String responseBody = result.getResponse().getContentAsString();
                    String expiresAtRaw = responseBody.replaceAll(".*\"expiresAt\":(\\d+).*", "$1");
                    try {
                        long expiresAt = Long.parseLong(expiresAtRaw);
                        assertThat(expiresAt).isBetween(before + 3_590_000, before + 3_610_000);
                    } catch (NumberFormatException e) {
                        fail("Unable to parse expiresAt as a long from response body: " + responseBody, e);
                    }
                });
    }

    @Test
    void loginStoresThePlayerInANewSession() throws Exception {
        when(supabase.signInWithPassword("joueur@example.com", "secret-123")).thenReturn(PLAYER);
        MockHttpSession session = new MockHttpSession();
        String idBefore = session.getId();

        MvcResult result = mvc.perform(postJson("/api/auth/login", """
                        {"email": "joueur@example.com", "password": "secret-123"}""").session(session))
                .andExpect(status().isNoContent())
                .andReturn();

        MockHttpSession after = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(after.getAttribute(AuthSession.USER)).isEqualTo(PLAYER);
        // Protection contre la fixation de session : l'identifiant change à la connexion.
        assertThat(after.getId()).isNotEqualTo(idBefore);
    }

    @Test
    void loginRejectsMissingFieldsWithoutCallingSupabase() throws Exception {
        mvc.perform(postJson("/api/auth/login", "{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.email").value("Indique ton adresse email."))
                .andExpect(jsonPath("$.fields.password").value("Indique ton mot de passe."));
        verifyNoInteractions(supabase);
    }

    @Test
    void loginRefusedBySupabaseOpensNoSession() throws Exception {
        when(supabase.signInWithPassword(anyString(), anyString()))
                .thenThrow(new AuthException(400, "Email ou mot de passe incorrect."));

        MvcResult result = mvc.perform(postJson("/api/auth/login", """
                        {"email": "joueur@example.com", "password": "mauvais"}"""))
                .andExpect(status().isBadRequest())
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void signupWithEmailConfirmationOpensNoSession() throws Exception {
        when(supabase.signUp("joueur@example.com", "secret-123", "joueur_42", "http://localhost:5173"))
                .thenReturn(new SupabaseAuthClient.SignUpResult(PLAYER, false));

        MvcResult result = mvc.perform(postJson("/api/auth/signup", """
                        {"email": "joueur@example.com", "password": "secret-123", "username": "joueur_42"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmationRequired").value(true))
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void signupWithoutConfirmationSignsThePlayerIn() throws Exception {
        when(supabase.signUp(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new SupabaseAuthClient.SignUpResult(PLAYER, true));

        MvcResult result = mvc.perform(postJson("/api/auth/signup", """
                        {"email": "joueur@example.com", "password": "secret-123", "username": "joueur_42"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmationRequired").value(false))
                .andReturn();

        assertThat(result.getRequest().getSession(false).getAttribute(AuthSession.USER))
                .isEqualTo(PLAYER);
    }

    @Test
    void forgotPasswordSendsTheLinkToTheResetPage() throws Exception {
        mvc.perform(postJson("/api/auth/password/forgot", """
                        {"email": "joueur@example.com"}""")).andExpect(status().isNoContent());

        verify(supabase).sendPasswordRecovery("joueur@example.com", "http://localhost:5173/update-password");
    }

    @Test
    void forgotPasswordRejectsAnInvalidEmail() throws Exception {
        mvc.perform(postJson("/api/auth/password/forgot", """
                        {"email": "joueur@"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Cette adresse email n’est pas valide."));
        verifyNoInteractions(supabase);
    }

    @Test
    void resetPasswordUsesTheTokenOfTheLinkThenSignsThePlayerIn() throws Exception {
        when(supabase.updatePasswordWithRecoveryToken("recovery-token", "nouveau-secret"))
                .thenReturn(PLAYER);

        MvcResult result = mvc.perform(postJson("/api/auth/password/reset", """
                        {"accessToken": "recovery-token", "password": "nouveau-secret"}"""))
                .andExpect(status().isNoContent())
                .andReturn();

        assertThat(result.getRequest().getSession(false).getAttribute(AuthSession.USER))
                .isEqualTo(PLAYER);
    }

    @Test
    void resetPasswordWithoutTokenIsRefused() throws Exception {
        mvc.perform(postJson("/api/auth/password/reset", """
                        {"accessToken": "", "password": "nouveau-secret"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("Le lien de réinitialisation est invalide : demandes-en un nouveau."));
        verifyNoInteractions(supabase);
    }

    @Test
    void changePasswordOfTheSignedInPlayer() throws Exception {
        mvc.perform(postJson("/api/auth/password", """
                        {"password": "nouveau-secret"}""").session(signedInSession()))
                .andExpect(status().isNoContent());

        verify(supabase).updatePassword("u-1", "nouveau-secret");
    }

    @Test
    void changePasswordWithoutSessionIsUnauthorized() throws Exception {
        mvc.perform(postJson("/api/auth/password", """
                        {"password": "nouveau-secret"}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Non connecté"));
        verifyNoInteractions(supabase);
    }

    @Test
    void changePasswordRejectsAShortPassword() throws Exception {
        mvc.perform(postJson("/api/auth/password", """
                        {"password": "court"}""").session(signedInSession()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Le mot de passe doit contenir au moins 8 caractères."));
        verifyNoInteractions(supabase);
    }

    @Test
    void logoutDestroysTheSession() throws Exception {
        MockHttpSession session = signedInSession();

        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isNoContent());

        assertThat(session.isInvalid()).isTrue();
    }

    @Test
    void logoutWithoutSessionStillSucceeds() throws Exception {
        mvc.perform(post("/api/auth/logout")).andExpect(status().isNoContent());
    }

    @Test
    void googleRemembersTheReturnPageThenRedirectsToSpringSecurity() throws Exception {
        MvcResult result = mvc.perform(get("/api/auth/google").param("redirect", "/games/clicker"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "/oauth2/authorization/google"))
                .andReturn();

        assertThat(result.getRequest().getSession(false).getAttribute(AuthSession.GOOGLE_REDIRECT))
                .isEqualTo("/games/clicker");
    }

    @Test
    void googleReplacesAnExternalReturnPageByTheHome() throws Exception {
        MvcResult result = mvc.perform(get("/api/auth/google").param("redirect", "https://evil.example/piege"))
                .andExpect(status().isFound())
                .andReturn();

        assertThat(result.getRequest().getSession(false).getAttribute(AuthSession.GOOGLE_REDIRECT))
                .isEqualTo("/");
    }
}
