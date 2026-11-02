package fr.tikigaming.auth;

import fr.tikigaming.config.TikiProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.ResourceAccessException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    record Credentials(String email, String password) {}

    record SignUpRequest(String email, String password, String username) {}

    record EmailRequest(String email) {}

    record PasswordRequest(String password) {}

    record PasswordResetRequest(String accessToken, String password) {}

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final SupabaseAuthClient supabase;
    private final SupabaseTokenService tokens;
    private final String frontendUrl;

    public AuthController(SupabaseAuthClient supabase, SupabaseTokenService tokens, TikiProperties props) {
        this.supabase = supabase;
        this.tokens = tokens;
        this.frontendUrl = props.frontendUrl();
    }

    /** Utilisateur courant + JWT Supabase à passer à supabase-js. Émet aussi le cookie CSRF. */
    @GetMapping("/session")
    Map<String, Object> session(HttpServletRequest request, CsrfToken csrf) {
        csrf.getToken();
        AuthUser user = AuthSession.currentUser(request);
        Map<String, Object> body = new HashMap<>();
        body.put("user", user);
        if (user != null) {
            SupabaseTokenService.IssuedToken token = tokens.issue(user);
            body.put("accessToken", token.value());
            body.put("expiresAt", token.expiresAt().toEpochMilli());
        }
        return body;
    }

    @GetMapping("/google")
    ResponseEntity<Void> google(@RequestParam(required = false) String redirect, HttpServletRequest request) {
        request.getSession(true).setAttribute(AuthSession.GOOGLE_REDIRECT, AuthSession.safeRedirect(redirect));
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create("/oauth2/authorization/google"))
                .build();
    }

    @PostMapping("/login")
    ResponseEntity<Void> login(@RequestBody Credentials body, HttpServletRequest request) {
        AuthSession.signIn(request, supabase.signInWithPassword(body.email(), body.password()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/signup")
    Map<String, Boolean> signUp(@RequestBody SignUpRequest body, HttpServletRequest request) {
        requireStrongPassword(body.password());
        SupabaseAuthClient.SignUpResult result =
                supabase.signUp(body.email(), body.password(), body.username(), frontendUrl);
        if (result.signedIn()) AuthSession.signIn(request, result.user());
        return Map.of("confirmationRequired", !result.signedIn());
    }

    @PostMapping("/password/forgot")
    ResponseEntity<Void> forgotPassword(@RequestBody EmailRequest body) {
        supabase.sendPasswordRecovery(body.email(), frontendUrl + "/update-password");
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password/reset")
    ResponseEntity<Void> resetPassword(@RequestBody PasswordResetRequest body, HttpServletRequest request) {
        requireStrongPassword(body.password());
        AuthUser user = supabase.updatePasswordWithRecoveryToken(body.accessToken(), body.password());
        AuthSession.signIn(request, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password")
    ResponseEntity<Void> changePassword(@RequestBody PasswordRequest body, HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) throw new AuthException(401, "Non connecté");
        requireStrongPassword(body.password());
        supabase.updatePassword(user.id(), body.password());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(AuthException.class)
    ResponseEntity<Map<String, String>> handleAuthError(AuthException e) {
        // Les erreurs 5xx de Supabase sont remontées comme une passerelle en échec.
        int status = e.status() >= 400 && e.status() < 500 ? e.status() : HttpStatus.BAD_GATEWAY.value();
        return ResponseEntity.status(status).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(ResourceAccessException.class)
    ResponseEntity<Map<String, String>> handleSupabaseUnreachable(ResourceAccessException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("error", "Service d'authentification injoignable. Réessaie plus tard."));
    }

    private static void requireStrongPassword(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new AuthException(
                    400, "Le mot de passe doit contenir au moins " + MIN_PASSWORD_LENGTH + " caractères.");
        }
    }
}
