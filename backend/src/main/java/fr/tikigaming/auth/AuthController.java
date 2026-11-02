package fr.tikigaming.auth;

import com.fasterxml.jackson.annotation.JsonInclude;
import fr.tikigaming.config.TikiProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
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
@Tag(
        name = "Authentification",
        description = "Connexion (Google, email/mot de passe), session et mots de passe. "
                + "Les comptes restent dans Supabase Auth.")
public class AuthController {

    record Credentials(
            @Schema(example = "joueur@example.com") String email,
            @Schema(example = "motdepasse-de-test") String password) {}

    record SignUpRequest(
            @Schema(example = "joueur@example.com") String email,

            @Schema(example = "motdepasse-de-test", minLength = 8)
            String password,

            @Schema(example = "joueur_42", pattern = "^[A-Za-z0-9_]{3,24}$")
            String username) {}

    record EmailRequest(
            @Schema(example = "joueur@example.com") String email) {}

    record PasswordRequest(
            @Schema(example = "nouveau-motdepasse", minLength = 8)
            String password) {}

    record PasswordResetRequest(
            @Schema(description = "access_token reçu dans le lien de réinitialisation (après #)")
            String accessToken,

            @Schema(example = "nouveau-motdepasse", minLength = 8)
            String password) {}

    record SessionResponse(
            @Schema(description = "Utilisateur connecté, ou null en invité", nullable = true)
            AuthUser user,

            @Schema(description = "JWT Supabase à passer à supabase-js (absent en invité)")
            @JsonInclude(JsonInclude.Include.NON_NULL)
            String accessToken,

            @Schema(description = "Expiration du JWT, en millisecondes depuis l'époque Unix")
            @JsonInclude(JsonInclude.Include.NON_NULL)
            Long expiresAt) {}

    record SignUpResponse(
            @Schema(description = "true si un email de confirmation a été envoyé (pas de session ouverte)")
            boolean confirmationRequired) {}

    record ErrorResponse(
            @Schema(example = "Invalid login credentials") String error) {}

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final SupabaseAuthClient supabase;
    private final SupabaseTokenService tokens;
    private final String frontendUrl;

    public AuthController(SupabaseAuthClient supabase, SupabaseTokenService tokens, TikiProperties props) {
        this.supabase = supabase;
        this.tokens = tokens;
        this.frontendUrl = props.frontendUrl();
    }

    @GetMapping("/session")
    @Operation(
            summary = "Session courante",
            description = "Renvoie l'utilisateur connecté et un JWT Supabase valable 1 h. "
                    + "Émet aussi le cookie XSRF-TOKEN nécessaire aux POST.")
    @ApiResponse(responseCode = "200", description = "Session (user null en invité)")
    SessionResponse session(HttpServletRequest request, @Parameter(hidden = true) CsrfToken csrf) {
        csrf.getToken();
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) return new SessionResponse(null, null, null);
        SupabaseTokenService.IssuedToken token = tokens.issue(user);
        return new SessionResponse(user, token.value(), token.expiresAt().toEpochMilli());
    }

    @GetMapping("/google")
    @Operation(
            summary = "Démarrer la connexion Google",
            description = "Mémorise la page de retour puis redirige vers /oauth2/authorization/google. "
                    + "À ouvrir dans le navigateur (depuis le front), pas via « Try it out ».")
    @ApiResponse(responseCode = "302", description = "Redirection vers Google", content = @Content)
    ResponseEntity<Void> google(
            @Parameter(description = "Chemin relatif de retour après connexion", example = "/games/clicker")
                    @RequestParam(required = false)
                    String redirect,
            HttpServletRequest request) {
        request.getSession(true).setAttribute(AuthSession.GOOGLE_REDIRECT, AuthSession.safeRedirect(redirect));
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create("/oauth2/authorization/google"))
                .build();
    }

    @PostMapping("/login")
    @Operation(summary = "Connexion email + mot de passe", description = "Ouvre la session HTTP.")
    @ApiResponse(responseCode = "204", description = "Connecté", content = @Content)
    @ApiResponse(responseCode = "400", description = "Identifiants invalides")
    ResponseEntity<Void> login(@RequestBody Credentials body, HttpServletRequest request) {
        AuthSession.signIn(request, supabase.signInWithPassword(body.email(), body.password()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/signup")
    @Operation(
            summary = "Inscription",
            description = "Crée le compte Supabase ; le profil est créé avec le pseudo. "
                    + "Sans confirmation email, la session est ouverte directement.")
    @ApiResponse(responseCode = "200", description = "Compte créé")
    @ApiResponse(responseCode = "400", description = "Mot de passe trop court ou données invalides")
    SignUpResponse signUp(@RequestBody SignUpRequest body, HttpServletRequest request) {
        requireStrongPassword(body.password());
        SupabaseAuthClient.SignUpResult result =
                supabase.signUp(body.email(), body.password(), body.username(), frontendUrl);
        if (result.signedIn()) AuthSession.signIn(request, result.user());
        return new SignUpResponse(!result.signedIn());
    }

    @PostMapping("/password/forgot")
    @Operation(
            summary = "Mot de passe oublié",
            description = "Envoie un lien de réinitialisation vers /update-password. "
                    + "Répond 204 même si l'email est inconnu.")
    @ApiResponse(responseCode = "204", description = "Demande prise en compte", content = @Content)
    ResponseEntity<Void> forgotPassword(@RequestBody EmailRequest body) {
        supabase.sendPasswordRecovery(body.email(), frontendUrl + "/update-password");
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password/reset")
    @Operation(
            summary = "Réinitialiser le mot de passe",
            description =
                    "Applique le nouveau mot de passe avec le jeton du lien reçu par email, puis ouvre la session.")
    @ApiResponse(responseCode = "204", description = "Mot de passe changé, connecté", content = @Content)
    @ApiResponse(responseCode = "400", description = "Mot de passe trop court")
    @ApiResponse(responseCode = "401", description = "Jeton invalide ou expiré")
    ResponseEntity<Void> resetPassword(@RequestBody PasswordResetRequest body, HttpServletRequest request) {
        requireStrongPassword(body.password());
        AuthUser user = supabase.updatePasswordWithRecoveryToken(body.accessToken(), body.password());
        AuthSession.signIn(request, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password")
    @Operation(summary = "Changer de mot de passe", description = "Nécessite d'être connecté.")
    @ApiResponse(responseCode = "204", description = "Mot de passe changé", content = @Content)
    @ApiResponse(responseCode = "400", description = "Mot de passe trop court")
    @ApiResponse(responseCode = "401", description = "Non connecté")
    ResponseEntity<Void> changePassword(@RequestBody PasswordRequest body, HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) throw new AuthException(401, "Non connecté");
        requireStrongPassword(body.password());
        supabase.updatePassword(user.id(), body.password());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    @Operation(summary = "Déconnexion", description = "Ferme la session HTTP.")
    @ApiResponse(responseCode = "204", description = "Déconnecté", content = @Content)
    ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(AuthException.class)
    ResponseEntity<ErrorResponse> handleAuthError(AuthException e) {
        // Les erreurs 5xx de Supabase sont remontées comme une passerelle en échec.
        int status = e.status() >= 400 && e.status() < 500 ? e.status() : HttpStatus.BAD_GATEWAY.value();
        return ResponseEntity.status(status).body(new ErrorResponse(e.getMessage()));
    }

    @ExceptionHandler(ResourceAccessException.class)
    ResponseEntity<ErrorResponse> handleSupabaseUnreachable(ResourceAccessException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse("Service d'authentification injoignable. Réessaie plus tard."));
    }

    private static void requireStrongPassword(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new AuthException(
                    400, "Le mot de passe doit contenir au moins " + MIN_PASSWORD_LENGTH + " caractères.");
        }
    }
}
