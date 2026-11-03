package fr.tikigaming.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fr.tikigaming.config.TikiProperties;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Requêtes envoyées à Supabase et lecture de ses réponses, sans réseau. */
class SupabaseAuthClientTest {

    private static final String URL = "https://ref.supabase.co";
    private static final String ANON = "anon-key";
    private static final String SERVICE = "service-role-key";
    private static final String USER_JSON = """
            {"id": "u-1", "email": "joueur@example.com"}""";

    private MockRestServiceServer server;
    private SupabaseAuthClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        TikiProperties props = new TikiProperties(
                "http://localhost:5173",
                new TikiProperties.Supabase(URL, ANON, SERVICE, "jwt-secret", Duration.ofHours(1)));
        client = new SupabaseAuthClient(builder, props, JsonMapper.builder().build());
    }

    @Nested
    class SignIn {

        @Test
        void sendsCredentialsWithTheAnonKeyAndReadsTheUser() {
            server.expect(requestTo(URL + "/auth/v1/token?grant_type=password"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(header("apikey", ANON))
                    .andExpect(content().json("""
                            {"email": "joueur@example.com", "password": "secret-123"}"""))
                    .andRespond(withSuccess(
                            "{\"access_token\": \"jwt\", \"user\": " + USER_JSON + "}", MediaType.APPLICATION_JSON));

            AuthUser user = client.signInWithPassword("joueur@example.com", "secret-123");

            assertThat(user).isEqualTo(new AuthUser("u-1", "joueur@example.com"));
            server.verify();
        }

        @Test
        void translatesTheErrorCodeOfSupabase() {
            server.expect(requestTo(URL + "/auth/v1/token?grant_type=password"))
                    .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body("""
                                    {"code": 400, "error_code": "invalid_credentials", "msg": "Invalid login credentials"}"""));

            assertThatThrownBy(() -> client.signInWithPassword("joueur@example.com", "mauvais"))
                    .isInstanceOfSatisfying(AuthException.class, e -> {
                        assertThat(e.status()).isEqualTo(400);
                        assertThat(e.getMessage()).isEqualTo("Email ou mot de passe incorrect.");
                    });
        }

        @Test
        void readsTheCodeFromTheCodeFieldOfOlderSupabaseVersions() {
            server.expect(requestTo(URL + "/auth/v1/token?grant_type=password"))
                    .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body("""
                                    {"code": "email_not_confirmed", "message": "Email not confirmed"}"""));

            assertThatThrownBy(() -> client.signInWithPassword("joueur@example.com", "secret-123"))
                    .hasMessage("Confirme ton adresse email avant de te connecter (vérifie tes emails).");
        }

        @Test
        void keepsTheMessageOfSupabaseWhenTheCodeIsUnknown() {
            server.expect(requestTo(URL + "/auth/v1/token?grant_type=password"))
                    .andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body("""
                                    {"error": "invalid_grant", "error_description": "Something new happened"}"""));

            assertThatThrownBy(() -> client.signInWithPassword("joueur@example.com", "secret-123"))
                    .isInstanceOfSatisfying(AuthException.class, e -> {
                        assertThat(e.status()).isEqualTo(422);
                        assertThat(e.getMessage()).isEqualTo("Something new happened");
                    });
        }

        @Test
        void usesAGenericMessageWhenTheErrorIsNotJson() {
            server.expect(requestTo(URL + "/auth/v1/token?grant_type=password"))
                    .andRespond(withStatus(HttpStatus.BAD_GATEWAY)
                            .contentType(MediaType.TEXT_HTML)
                            .body("<html>502 Bad Gateway</html>"));

            assertThatThrownBy(() -> client.signInWithPassword("joueur@example.com", "secret-123"))
                    .isInstanceOfSatisfying(AuthException.class, e -> {
                        assertThat(e.status()).isEqualTo(502);
                        assertThat(e.getMessage()).isEqualTo(SupabaseErrors.DEFAULT_MESSAGE);
                    });
        }

        @Test
        void usesAGenericMessageWhenTheErrorBodyIsEmpty() {
            server.expect(requestTo(URL + "/auth/v1/token?grant_type=password"))
                    .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

            assertThatThrownBy(() -> client.signInWithPassword("joueur@example.com", "secret-123"))
                    .hasMessage(SupabaseErrors.DEFAULT_MESSAGE);
        }

        @Test
        void usesTheCodeAloneWhenNoMessageIsGiven() {
            server.expect(requestTo(URL + "/auth/v1/token?grant_type=password"))
                    .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body("""
                                    {"error_code": "over_request_rate_limit"}"""));

            assertThatThrownBy(() -> client.signInWithPassword("joueur@example.com", "secret-123"))
                    .hasMessage("Trop de tentatives. Patiente quelques minutes avant de réessayer.");
        }
    }

    @Nested
    class SignUp {

        @Test
        void sendsTheUsernameForTheProfileTriggerAndTheRedirect() {
            server.expect(requestTo(URL + "/auth/v1/signup?redirect_to=http://localhost:5173"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(header("apikey", ANON))
                    .andExpect(content().json("""
                            {"email": "joueur@example.com", "password": "secret-123",
                             "data": {"username": "joueur_42"}}"""))
                    .andRespond(withSuccess(USER_JSON, MediaType.APPLICATION_JSON));

            SupabaseAuthClient.SignUpResult result =
                    client.signUp("joueur@example.com", "secret-123", "joueur_42", "http://localhost:5173");

            // Sans access_token : confirmation par email demandée, pas de session.
            assertThat(result.signedIn()).isFalse();
            assertThat(result.user()).isEqualTo(new AuthUser("u-1", "joueur@example.com"));
            server.verify();
        }

        @Test
        void opensTheSessionWhenSupabaseReturnsATokenDirectly() {
            server.expect(requestTo(URL + "/auth/v1/signup?redirect_to=http://localhost:5173"))
                    .andRespond(withSuccess(
                            "{\"access_token\": \"jwt\", \"user\": " + USER_JSON + "}", MediaType.APPLICATION_JSON));

            SupabaseAuthClient.SignUpResult result =
                    client.signUp("joueur@example.com", "secret-123", "joueur_42", "http://localhost:5173");

            assertThat(result.signedIn()).isTrue();
            assertThat(result.user().id()).isEqualTo("u-1");
        }

        @Test
        void translatesAnAlreadyRegisteredEmail() {
            server.expect(requestTo(URL + "/auth/v1/signup?redirect_to=http://localhost:5173"))
                    .andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body("""
                                    {"error_code": "user_already_exists", "msg": "User already registered"}"""));

            assertThatThrownBy(() ->
                            client.signUp("joueur@example.com", "secret-123", "joueur_42", "http://localhost:5173"))
                    .hasMessage("Un compte existe déjà avec cette adresse email.");
        }
    }

    @Nested
    class Passwords {

        @Test
        void recoverySendsTheEmailAndTheResetPage() {
            server.expect(requestTo(URL + "/auth/v1/recover?redirect_to=http://localhost:5173/update-password"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(header("apikey", ANON))
                    .andExpect(content().json("""
                            {"email": "joueur@example.com"}"""))
                    .andRespond(withSuccess());

            client.sendPasswordRecovery("joueur@example.com", "http://localhost:5173/update-password");

            server.verify();
        }

        @Test
        void resetUsesTheRecoveryTokenOfTheLinkAndReadsTheUser() {
            server.expect(requestTo(URL + "/auth/v1/user"))
                    .andExpect(method(HttpMethod.PUT))
                    .andExpect(header("apikey", ANON))
                    .andExpect(header("Authorization", "Bearer recovery-token"))
                    .andExpect(content().json("""
                            {"password": "nouveau-secret"}"""))
                    .andRespond(withSuccess(USER_JSON, MediaType.APPLICATION_JSON));

            AuthUser user = client.updatePasswordWithRecoveryToken("recovery-token", "nouveau-secret");

            assertThat(user).isEqualTo(new AuthUser("u-1", "joueur@example.com"));
            server.verify();
        }

        @Test
        void resetWithAnExpiredLinkIsTranslated() {
            server.expect(requestTo(URL + "/auth/v1/user"))
                    .andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body("""
                                    {"error_code": "bad_jwt", "msg": "invalid JWT"}"""));

            assertThatThrownBy(() -> client.updatePasswordWithRecoveryToken("expired", "nouveau-secret"))
                    .isInstanceOfSatisfying(AuthException.class, e -> {
                        assertThat(e.status()).isEqualTo(401);
                        assertThat(e.getMessage()).isEqualTo("Le lien a expiré : demandes-en un nouveau.");
                    });
        }

        @Test
        void changeUsesTheAdminApiWithTheServiceRoleKey() {
            server.expect(requestTo(URL + "/auth/v1/admin/users/u-1"))
                    .andExpect(method(HttpMethod.PUT))
                    .andExpect(header("apikey", SERVICE))
                    .andExpect(header("Authorization", "Bearer " + SERVICE))
                    .andExpect(content().json("""
                            {"password": "nouveau-secret"}"""))
                    .andRespond(withSuccess());

            client.updatePassword("u-1", "nouveau-secret");

            server.verify();
        }
    }

    @Nested
    class FindOrCreateUser {

        private void expectLookup(String responseBody) {
            server.expect(requestTo(URL + "/rest/v1/rpc/find_auth_user_id"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(header("apikey", SERVICE))
                    .andExpect(header("Authorization", "Bearer " + SERVICE))
                    .andExpect(content().json("""
                            {"p_email": "joueur@example.com"}"""))
                    .andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON));
        }

        @Test
        void reusesTheExistingAccountWithoutCreatingOne() {
            expectLookup("\"u-existant\"");

            AuthUser user = client.findOrCreateUser("joueur@example.com", "Joueur");

            assertThat(user).isEqualTo(new AuthUser("u-existant", "joueur@example.com"));
            server.verify();
        }

        @Test
        void createsAConfirmedAccountWithTheGoogleNameAsUsername() {
            expectLookup("null");
            server.expect(requestTo(URL + "/auth/v1/admin/users"))
                    .andExpect(method(HttpMethod.POST))
                    .andExpect(header("apikey", SERVICE))
                    .andExpect(content().json("""
                            {"email": "joueur@example.com", "email_confirm": true,
                             "user_metadata": {"username": "Joueur Google"}}"""))
                    .andRespond(withSuccess(USER_JSON, MediaType.APPLICATION_JSON));

            AuthUser user = client.findOrCreateUser("joueur@example.com", "Joueur Google");

            assertThat(user).isEqualTo(new AuthUser("u-1", "joueur@example.com"));
            server.verify();
        }

        @Test
        void sendsAnEmptyUsernameWhenGoogleGivesNoName() {
            expectLookup("null");
            server.expect(requestTo(URL + "/auth/v1/admin/users"))
                    .andExpect(content().json("""
                            {"user_metadata": {"username": ""}}"""))
                    .andRespond(withSuccess(USER_JSON, MediaType.APPLICATION_JSON));

            client.findOrCreateUser("joueur@example.com", null);

            server.verify();
        }

        @Test
        void rereadsTheAccountCreatedConcurrentlyByAnotherRequest() {
            expectLookup("null");
            server.expect(requestTo(URL + "/auth/v1/admin/users"))
                    .andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body("""
                                    {"error_code": "email_exists", "msg": "A user with this email already exists"}"""));
            expectLookup("\"u-concurrent\"");

            AuthUser user = client.findOrCreateUser("joueur@example.com", "Joueur");

            assertThat(user).isEqualTo(new AuthUser("u-concurrent", "joueur@example.com"));
            server.verify();
        }

        @Test
        void reportsTheCreationErrorWhenTheAccountStillDoesNotExist() {
            expectLookup("null");
            server.expect(requestTo(URL + "/auth/v1/admin/users"))
                    .andRespond(withStatus(HttpStatus.FORBIDDEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body("""
                                    {"error_code": "signup_disabled", "msg": "Signups not allowed"}"""));
            expectLookup("null");

            assertThatThrownBy(() -> client.findOrCreateUser("joueur@example.com", "Joueur"))
                    .isInstanceOfSatisfying(AuthException.class, e -> {
                        assertThat(e.status()).isEqualTo(403);
                        assertThat(e.getMessage()).isEqualTo("Les inscriptions sont fermées pour le moment.");
                    });
            server.verify();
        }
    }
}
