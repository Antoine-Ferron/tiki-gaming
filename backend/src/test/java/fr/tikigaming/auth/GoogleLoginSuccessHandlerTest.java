package fr.tikigaming.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import fr.tikigaming.config.TikiProperties;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.web.client.ResourceAccessException;

/** Retour de Google : rattachement au compte Supabase, page de retour, refus. */
class GoogleLoginSuccessHandlerTest {

    private static final String FRONT = "http://localhost:5173";
    private static final AuthUser PLAYER = new AuthUser("u-1", "joueur@gmail.com");

    private final SupabaseAuthClient supabase = mock(SupabaseAuthClient.class);
    private final GoogleLoginSuccessHandler handler = new GoogleLoginSuccessHandler(
            supabase,
            new TikiProperties(
                    FRONT, new TikiProperties.Supabase("https://ref.supabase.co", "a", "s", "j", Duration.ofHours(1))));
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    private static OAuth2AuthenticationToken google(String email, Object emailVerified) {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("sub", "google-123");
        attributes.put("name", "Joueur Google");
        if (email != null) attributes.put("email", email);
        if (emailVerified != null) attributes.put("email_verified", emailVerified);
        var authorities = List.of(new SimpleGrantedAuthority("OAUTH2_USER"));
        return new OAuth2AuthenticationToken(
                new DefaultOAuth2User(authorities, attributes, "sub"), authorities, "google");
    }

    private Object sessionUser() {
        return request.getSession(false) == null
                ? null
                : request.getSession(false).getAttribute(AuthSession.USER);
    }

    @Test
    void verifiedEmailIsLinkedThenThePlayerReturnsToTheRequestedPage() throws Exception {
        when(supabase.findOrCreateUser("joueur@gmail.com", "Joueur Google")).thenReturn(PLAYER);
        request.getSession(true).setAttribute(AuthSession.GOOGLE_REDIRECT, "/games/clicker");

        handler.onAuthenticationSuccess(request, response, google("joueur@gmail.com", true));

        assertThat(response.getRedirectedUrl()).isEqualTo(FRONT + "/games/clicker");
        assertThat(sessionUser()).isEqualTo(PLAYER);
        // La page de retour ne sert qu'une fois.
        assertThat(request.getSession(false).getAttribute(AuthSession.GOOGLE_REDIRECT))
                .isNull();
    }

    @Test
    void withoutRememberedPageThePlayerReturnsToTheHome() throws Exception {
        when(supabase.findOrCreateUser(anyString(), anyString())).thenReturn(PLAYER);

        handler.onAuthenticationSuccess(request, response, google("joueur@gmail.com", true));

        assertThat(response.getRedirectedUrl()).isEqualTo(FRONT + "/");
    }

    @Test
    void anExternalRememberedPageIsNeverFollowed() throws Exception {
        when(supabase.findOrCreateUser(anyString(), anyString())).thenReturn(PLAYER);
        request.getSession(true).setAttribute(AuthSession.GOOGLE_REDIRECT, "//evil.example");

        handler.onAuthenticationSuccess(request, response, google("joueur@gmail.com", true));

        assertThat(response.getRedirectedUrl()).isEqualTo(FRONT + "/");
    }

    @Test
    void unverifiedEmailIsRefusedWithoutTouchingSupabase() throws Exception {
        handler.onAuthenticationSuccess(request, response, google("joueur@gmail.com", false));

        assertThat(response.getRedirectedUrl()).isEqualTo(FRONT + "/login?error=google-email");
        assertThat(sessionUser()).isNull();
        verifyNoInteractions(supabase);
    }

    @Test
    void emailVerifiedAsTextIsNotTrusted() throws Exception {
        handler.onAuthenticationSuccess(request, response, google("joueur@gmail.com", "true"));

        assertThat(response.getRedirectedUrl()).isEqualTo(FRONT + "/login?error=google-email");
        verifyNoInteractions(supabase);
    }

    @Test
    void missingEmailIsRefused() throws Exception {
        handler.onAuthenticationSuccess(request, response, google(null, true));

        assertThat(response.getRedirectedUrl()).isEqualTo(FRONT + "/login?error=google-email");
        verifyNoInteractions(supabase);
    }

    @Test
    void supabaseRefusalSendsBackToLoginWithoutSession() throws Exception {
        when(supabase.findOrCreateUser(anyString(), anyString()))
                .thenThrow(new AuthException(403, "Les inscriptions sont fermées pour le moment."));

        handler.onAuthenticationSuccess(request, response, google("joueur@gmail.com", true));

        assertThat(response.getRedirectedUrl()).isEqualTo(FRONT + "/login?error=google");
        assertThat(sessionUser()).isNull();
    }

    @Test
    void unreachableSupabaseSendsBackToLoginWithoutSession() throws Exception {
        when(supabase.findOrCreateUser(anyString(), anyString())).thenThrow(new ResourceAccessException("timeout"));

        handler.onAuthenticationSuccess(request, response, google("joueur@gmail.com", true));

        assertThat(response.getRedirectedUrl()).isEqualTo(FRONT + "/login?error=google");
        assertThat(sessionUser()).isNull();
    }
}
