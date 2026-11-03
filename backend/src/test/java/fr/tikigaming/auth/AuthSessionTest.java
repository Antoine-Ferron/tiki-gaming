package fr.tikigaming.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthSessionTest {

    private static final AuthUser PLAYER = new AuthUser("u-1", "joueur@example.com");

    @Test
    void noSessionMeansNoUser() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        assertThat(AuthSession.currentUser(request)).isNull();
        // Lire l'utilisateur ne doit pas créer de session (sinon chaque visiteur aurait un cookie).
        assertThat(request.getSession(false)).isNull();
    }

    @Test
    void signInStoresTheUserUnderANewSessionId() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        String idBefore = request.getSession(true).getId();

        AuthSession.signIn(request, PLAYER);

        assertThat(AuthSession.currentUser(request)).isEqualTo(PLAYER);
        assertThat(request.getSession(false).getId()).isNotEqualTo(idBefore);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/", "/games/clicker", "/profile?onglet=1"})
    void keepsPathsOfTheApplication(String path) {
        assertThat(AuthSession.safeRedirect(path)).isEqualTo(path);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(
            strings = {"", "games", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"})
    void replacesAnythingElseByTheHome(String path) {
        assertThat(AuthSession.safeRedirect(path)).isEqualTo("/");
    }
}
