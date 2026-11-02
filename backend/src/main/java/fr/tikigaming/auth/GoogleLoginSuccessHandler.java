package fr.tikigaming.auth;

import fr.tikigaming.config.TikiProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;

@Component
public class GoogleLoginSuccessHandler implements AuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(GoogleLoginSuccessHandler.class);

    private final SupabaseAuthClient supabase;
    private final String frontendUrl;

    public GoogleLoginSuccessHandler(SupabaseAuthClient supabase, TikiProperties props) {
        this.supabase = supabase;
        this.frontendUrl = props.frontendUrl();
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException {
        OAuth2User google = (OAuth2User) authentication.getPrincipal();
        String email = google.getAttribute("email");
        // Le compte est rattaché par email : seul un email vérifié par Google est accepté.
        if (email == null || !Boolean.TRUE.equals(google.getAttribute("email_verified"))) {
            response.sendRedirect(frontendUrl + "/login?error=google-email");
            return;
        }

        AuthUser user;
        try {
            user = supabase.findOrCreateUser(email, google.getAttribute("name"));
        } catch (AuthException | RestClientException e) {
            log.error("Rattachement du compte Google à Supabase impossible : {}", e.getMessage());
            response.sendRedirect(frontendUrl + "/login?error=google");
            return;
        }

        HttpSession session = request.getSession();
        String redirect = AuthSession.safeRedirect((String) session.getAttribute(AuthSession.GOOGLE_REDIRECT));
        session.removeAttribute(AuthSession.GOOGLE_REDIRECT);
        session.setAttribute(AuthSession.USER, user);
        response.sendRedirect(frontendUrl + redirect);
    }
}
