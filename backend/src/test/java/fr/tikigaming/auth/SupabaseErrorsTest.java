package fr.tikigaming.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SupabaseErrorsTest {

    @Test
    void translatesKnownGoTrueErrorCodes() {
        assertThat(SupabaseErrors.message("invalid_credentials", "Invalid login credentials"))
                .isEqualTo("Email ou mot de passe incorrect.");
        assertThat(SupabaseErrors.message("user_already_exists", "User already registered"))
                .isEqualTo("Un compte existe déjà avec cette adresse email.");
    }

    @Test
    void keepsSupabaseMessageForUnknownCodes() {
        assertThat(SupabaseErrors.message("brand_new_code", "Something new")).isEqualTo("Something new");
        assertThat(SupabaseErrors.message(null, null)).isEqualTo("Erreur du service d'authentification.");
    }
}
