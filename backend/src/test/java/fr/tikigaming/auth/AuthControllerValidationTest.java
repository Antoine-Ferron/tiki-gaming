package fr.tikigaming.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.config.ApiExceptionHandler;
import fr.tikigaming.config.TikiProperties;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AuthControllerValidationTest {

    private static final String APOSTROPHE_MESSAGE =
            "Caractère non autorisé : ' — utilise uniquement des lettres sans accent, des chiffres et _.";

    private final SupabaseAuthClient supabase = mock(SupabaseAuthClient.class);
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(
                        "https://ref.supabase.co",
                        "anon",
                        "service",
                        "super-secret-jwt-token-with-at-least-32-characters",
                        Duration.ofHours(1)));
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(supabase, new SupabaseTokenService(props), props))
                .setControllerAdvice(new ApiExceptionHandler())
                .defaultResponseCharacterEncoding(StandardCharsets.UTF_8)
                .build();
    }

    private ResultActions postJson(String path, String json) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void signupRejectsUsernameWithApostropheAndNamesTheCharacter() throws Exception {
        postJson("/api/auth/signup", """
                        {"username": "Anathos'", "email": "joueur@example.com", "password": "12345678"}""")
                .andExpect(status().isBadRequest())
                // Un seul champ en erreur : son message sert aussi de message global.
                .andExpect(jsonPath("$.error").value(APOSTROPHE_MESSAGE))
                .andExpect(jsonPath("$.fields.username").value(APOSTROPHE_MESSAGE));
        verifyNoInteractions(supabase);
    }

    @Test
    void signupListsEachForbiddenCharacterOnceIncludingSpaces() throws Exception {
        postJson("/api/auth/signup", """
                        {"username": "Zoé la-zoé", "email": "joueur@example.com", "password": "12345678"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.username")
                        .value("Caractères non autorisés : é, espace, - — utilise uniquement des lettres sans accent,"
                                + " des chiffres et _."));
    }

    @Test
    void signupMessageKeepsBracesAndDollarsLiteral() throws Exception {
        postJson("/api/auth/signup", """
                        {"username": "a{b}$c", "email": "joueur@example.com", "password": "12345678"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.username")
                        .value("Caractères non autorisés : {, }, $ — utilise uniquement des lettres sans accent,"
                                + " des chiffres et _."));
    }

    @Test
    void signupChecksUsernameLengthEmailAndPassword() throws Exception {
        postJson("/api/auth/signup", """
                        {"username": "ab", "email": "joueur@", "password": "court"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Certains champs sont invalides."))
                .andExpect(jsonPath("$.fields.username").value("Le pseudo doit contenir au moins 3 caractères."))
                .andExpect(jsonPath("$.fields.email").value("Cette adresse email n’est pas valide."))
                .andExpect(jsonPath("$.fields.password").value("Le mot de passe doit contenir au moins 8 caractères."));
    }

    @Test
    void signupReportsMissingFieldsWithTheRequiredMessage() throws Exception {
        postJson("/api/auth/signup", "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.username").value("Choisis un pseudo."))
                .andExpect(jsonPath("$.fields.email").value("Indique ton adresse email."))
                .andExpect(jsonPath("$.fields.password").value("Le mot de passe doit contenir au moins 8 caractères."));
    }

    @Test
    void signupWithValidDataReachesSupabase() throws Exception {
        when(supabase.signUp(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new SupabaseAuthClient.SignUpResult(new AuthUser("id", "joueur@example.com"), false));
        postJson("/api/auth/signup", """
                        {"username": "Anathos_42", "email": "joueur@example.com", "password": "12345678"}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmationRequired").value(true));
    }

    @Test
    void malformedJsonIsABadRequest() throws Exception {
        postJson("/api/auth/login", "{pas du json")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Requête invalide."));
    }

    @Test
    void supabaseClientErrorKeepsItsStatusAndMessage() throws Exception {
        when(supabase.signInWithPassword(anyString(), anyString()))
                .thenThrow(new AuthException(400, "Email ou mot de passe incorrect."));
        postJson("/api/auth/login", """
                        {"email": "joueur@example.com", "password": "mauvais"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Email ou mot de passe incorrect."));
    }

    @Test
    void supabaseServerErrorBecomesBadGatewayWithoutInternalDetails() throws Exception {
        when(supabase.signInWithPassword(anyString(), anyString()))
                .thenThrow(new AuthException(500, "database connection pool exhausted"));
        postJson("/api/auth/login", """
                        {"email": "joueur@example.com", "password": "12345678"}""")
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error")
                        .value("Le service d'authentification rencontre un problème. Réessaie plus tard."));
    }

    @Test
    void unexpectedErrorIsAGeneric500() throws Exception {
        when(supabase.signInWithPassword(any(), any())).thenThrow(new IllegalStateException("NPE interne"));
        postJson("/api/auth/login", """
                        {"email": "joueur@example.com", "password": "12345678"}""")
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Une erreur inattendue est survenue. Réessaie plus tard."));
    }
}
