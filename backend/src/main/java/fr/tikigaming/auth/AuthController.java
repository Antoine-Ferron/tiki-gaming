package fr.tikigaming.auth;

import fr.tikigaming.config.TikiProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    // Règles et messages alignés sur frontend/src/lib/validation.ts.
    private static final String EMAIL_REQUIRED = "Indique ton adresse email.";
    private static final String EMAIL_INVALID = "Cette adresse email n’est pas valide.";
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final String PASSWORD_TOO_SHORT =
            "Le mot de passe doit contenir au moins " + MIN_PASSWORD_LENGTH + " caractères.";

    record Credentials(
            @NotBlank(message = EMAIL_REQUIRED) @Email(message = EMAIL_INVALID)
            String email,

            @NotBlank(message = "Indique ton mot de passe.") String password) {}

    record SignUpRequest(
            @NotBlank(message = EMAIL_REQUIRED) @Email(message = EMAIL_INVALID)
            String email,

            @NotNull(message = PASSWORD_TOO_SHORT) @Size(min = MIN_PASSWORD_LENGTH, message = PASSWORD_TOO_SHORT)
            String password,

            @Username String username) {}

    record EmailRequest(
            @NotBlank(message = EMAIL_REQUIRED) @Email(message = EMAIL_INVALID)
            String email) {}

    record PasswordRequest(
            @NotNull(message = PASSWORD_TOO_SHORT) @Size(min = MIN_PASSWORD_LENGTH, message = PASSWORD_TOO_SHORT)
            String password) {}

    record PasswordResetRequest(
            @NotBlank(message = "Le lien de réinitialisation est invalide : demandes-en un nouveau.")
            String accessToken,

            @NotNull(message = PASSWORD_TOO_SHORT) @Size(min = MIN_PASSWORD_LENGTH, message = PASSWORD_TOO_SHORT)
            String password) {}

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
    ResponseEntity<Void> login(@Valid @RequestBody Credentials body, HttpServletRequest request) {
        AuthSession.signIn(request, supabase.signInWithPassword(body.email(), body.password()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/signup")
    Map<String, Boolean> signUp(@Valid @RequestBody SignUpRequest body, HttpServletRequest request) {
        SupabaseAuthClient.SignUpResult result =
                supabase.signUp(body.email(), body.password(), body.username(), frontendUrl);
        if (result.signedIn()) AuthSession.signIn(request, result.user());
        return Map.of("confirmationRequired", !result.signedIn());
    }

    @PostMapping("/password/forgot")
    ResponseEntity<Void> forgotPassword(@Valid @RequestBody EmailRequest body) {
        supabase.sendPasswordRecovery(body.email(), frontendUrl + "/update-password");
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password/reset")
    ResponseEntity<Void> resetPassword(@Valid @RequestBody PasswordResetRequest body, HttpServletRequest request) {
        AuthUser user = supabase.updatePasswordWithRecoveryToken(body.accessToken(), body.password());
        AuthSession.signIn(request, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password")
    ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordRequest body, HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) throw new AuthException(401, "Non connecté");
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
}
