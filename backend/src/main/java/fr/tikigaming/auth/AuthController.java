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
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(
        name = "Authentification",
        description = "Connexion (Google, email/mot de passe), session et mots de passe. "
                + "Les comptes restent dans Supabase Auth.")
public class AuthController {

    // Règles et messages alignés sur frontend/src/lib/validation.ts.
    private static final String EMAIL_REQUIRED = "Indique ton adresse email.";
    private static final String EMAIL_INVALID = "Cette adresse email n’est pas valide.";
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final String PASSWORD_TOO_SHORT =
            "Le mot de passe doit contenir au moins " + MIN_PASSWORD_LENGTH + " caractères.";

    record Credentials(
            @Schema(example = "joueur@example.com") @NotBlank(message = EMAIL_REQUIRED) @Email(message = EMAIL_INVALID)
            String email,

            @Schema(example = "motdepasse-de-test") @NotBlank(message = "Indique ton mot de passe.")
            String password) {}

    record SignUpRequest(
            @Schema(example = "joueur@example.com") @NotBlank(message = EMAIL_REQUIRED) @Email(message = EMAIL_INVALID)
            String email,

            @Schema(example = "motdepasse-de-test", minLength = MIN_PASSWORD_LENGTH)
            @NotNull(message = PASSWORD_TOO_SHORT)
            @Size(min = MIN_PASSWORD_LENGTH, message = PASSWORD_TOO_SHORT)
            String password,

            @Schema(example = "joueur_42", pattern = "^[A-Za-z0-9_]{3,24}$") @Username
            String username) {}

    record EmailRequest(
            @Schema(example = "joueur@example.com") @NotBlank(message = EMAIL_REQUIRED) @Email(message = EMAIL_INVALID)
            String email) {}

    record PasswordRequest(
            @Schema(example = "nouveau-motdepasse", minLength = MIN_PASSWORD_LENGTH)
            @NotNull(message = PASSWORD_TOO_SHORT)
            @Size(min = MIN_PASSWORD_LENGTH, message = PASSWORD_TOO_SHORT)
            String password) {}

    record PasswordResetRequest(
            @Schema(description = "access_token reçu dans le lien de réinitialisation (après #)")
            @NotBlank(message = "Le lien de réinitialisation est invalide : demandes-en un nouveau.")
            String accessToken,

            @Schema(example = "nouveau-motdepasse", minLength = MIN_PASSWORD_LENGTH)
            @NotNull(message = PASSWORD_TOO_SHORT)
            @Size(min = MIN_PASSWORD_LENGTH, message = PASSWORD_TOO_SHORT)
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
    @ApiResponse(responseCode = "400", description = "Champs invalides ou identifiants incorrects")
    ResponseEntity<Void> login(@Valid @RequestBody Credentials body, HttpServletRequest request) {
        AuthSession.signIn(request, supabase.signInWithPassword(body.email(), body.password()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/signup")
    @Operation(
            summary = "Inscription",
            description = "Crée le compte Supabase ; le profil est créé avec le pseudo. "
                    + "Sans confirmation email, la session est ouverte directement.")
    @ApiResponse(responseCode = "200", description = "Compte créé")
    @ApiResponse(responseCode = "400", description = "Champs invalides : un message par champ dans `fields`")
    SignUpResponse signUp(@Valid @RequestBody SignUpRequest body, HttpServletRequest request) {
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
    @ApiResponse(responseCode = "400", description = "Email manquant ou invalide")
    ResponseEntity<Void> forgotPassword(@Valid @RequestBody EmailRequest body) {
        supabase.sendPasswordRecovery(body.email(), frontendUrl + "/update-password");
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password/reset")
    @Operation(
            summary = "Réinitialiser le mot de passe",
            description =
                    "Applique le nouveau mot de passe avec le jeton du lien reçu par email, puis ouvre la session.")
    @ApiResponse(responseCode = "204", description = "Mot de passe changé, connecté", content = @Content)
    @ApiResponse(responseCode = "400", description = "Mot de passe trop court ou lien invalide")
    @ApiResponse(responseCode = "401", description = "Jeton invalide ou expiré")
    ResponseEntity<Void> resetPassword(@Valid @RequestBody PasswordResetRequest body, HttpServletRequest request) {
        AuthUser user = supabase.updatePasswordWithRecoveryToken(body.accessToken(), body.password());
        AuthSession.signIn(request, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password")
    @Operation(summary = "Changer de mot de passe", description = "Nécessite d'être connecté.")
    @ApiResponse(responseCode = "204", description = "Mot de passe changé", content = @Content)
    @ApiResponse(responseCode = "400", description = "Mot de passe trop court")
    @ApiResponse(responseCode = "401", description = "Non connecté")
    ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordRequest body, HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) throw new AuthException(401, "Non connecté");
        supabase.updatePassword(user.id(), body.password());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/account")
    @Operation(
            summary = "Supprimer mon compte",
            description = "RGPD, droit à l'effacement : supprime définitivement le compte Supabase, avec le profil, "
                    + "les scores et les sauvegardes, puis ferme la session.")
    @ApiResponse(responseCode = "204", description = "Compte supprimé, déconnecté", content = @Content)
    @ApiResponse(responseCode = "401", description = "Non connecté")
    @ApiResponse(responseCode = "502", description = "Supabase indisponible : rien n'est supprimé, la session reste")
    ResponseEntity<Void> deleteAccount(HttpServletRequest request) {
        AuthUser user = AuthSession.currentUser(request);
        if (user == null) throw new AuthException(401, "Non connecté");
        supabase.deleteUser(user.id());
        request.getSession().invalidate();
        SecurityContextHolder.clearContext();
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
}
