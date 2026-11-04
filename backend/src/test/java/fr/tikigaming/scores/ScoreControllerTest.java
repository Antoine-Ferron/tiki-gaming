package fr.tikigaming.scores;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthSession;
import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiException;
import fr.tikigaming.config.ApiExceptionHandler;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** POST /api/scores : session, validation de la requête et validateurs par jeu. Supabase est simulé. */
class ScoreControllerTest {

    private static final AuthUser PLAYER = new AuthUser("u-1", "joueur@example.com");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final SupabaseScoresClient supabase = mock(SupabaseScoresClient.class);

    private MockMvc mvc(ScoreValidator... validators) {
        return MockMvcBuilders.standaloneSetup(new ScoreController(new ScoreService(supabase, List.of(validators))))
                .setControllerAdvice(new ApiExceptionHandler())
                .defaultResponseCharacterEncoding(StandardCharsets.UTF_8)
                .build();
    }

    /** La session HTTP d'un joueur connecté, telle que la pose AuthSession.signIn. */
    private static MockHttpSession signedInSession() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession());
        AuthSession.signIn(request, PLAYER);
        return (MockHttpSession) request.getSession();
    }

    private static MockHttpServletRequestBuilder submit(String json) {
        return post("/api/scores").contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private static JsonNode json(String value) {
        return JSON.readTree(value);
    }

    @Test
    void recordsTheScoreForThePlayerOfTheSession() throws Exception {
        mvc().perform(submit("""
                        {"gameSlug": "clicker", "score": 120, "metadata": {"durationMs": 10000}}""").session(signedInSession())).andExpect(status().isNoContent());

        verify(supabase).insert("u-1", "clicker", 120, json("{\"durationMs\": 10000}"));
    }

    @Test
    void withoutMetadataRecordsAnEmptyObject() throws Exception {
        mvc().perform(submit("""
                        {"gameSlug": "clicker", "score": 0}""").session(signedInSession())).andExpect(status().isNoContent());

        verify(supabase).insert("u-1", "clicker", 0, json("{}"));
    }

    @Test
    void aGuestCannotRecordAScore() throws Exception {
        mvc().perform(submit("""
                        {"gameSlug": "clicker", "score": 120}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(ScoreController.NOT_SIGNED_IN));

        verifyNoInteractions(supabase);
    }

    // Valeurs limites basses : -1 refusé (0 est accepté ci-dessus)
    @Test
    void refusesANegativeScore() throws Exception {
        mvc().perform(submit("""
                        {"gameSlug": "clicker", "score": -1}""").session(signedInSession()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.score").value("Le score ne peut pas être négatif."));

        verifyNoInteractions(supabase);
    }

    @Test
    void refusesAMissingGameOrScore() throws Exception {
        mvc().perform(submit("{}").session(signedInSession()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.gameSlug").value("Indique le jeu."))
                .andExpect(jsonPath("$.fields.score").value("Indique le score."));

        verifyNoInteractions(supabase);
    }

    @Test
    void refusesMetadataThatIsNotAnObject() throws Exception {
        mvc().perform(submit("""
                        {"gameSlug": "clicker", "score": 1, "metadata": [1, 2]}""").session(signedInSession()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(ScoreController.INVALID_METADATA));

        verifyNoInteractions(supabase);
    }

    // Valeurs limites autour de la taille maximale des détails : à la limite accepté, un caractère de plus refusé
    @Test
    void acceptsMetadataUpToTheSizeLimit() throws Exception {
        mvc().perform(submit(withMetadataOfLength(ScoreController.MAX_METADATA_CHARS))
                        .session(signedInSession()))
                .andExpect(status().isNoContent());
    }

    @Test
    void refusesMetadataOverTheSizeLimit() throws Exception {
        mvc().perform(submit(withMetadataOfLength(ScoreController.MAX_METADATA_CHARS + 1))
                        .session(signedInSession()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(ScoreController.INVALID_METADATA));

        verifyNoInteractions(supabase);
    }

    /** Requête dont les détails, une fois sérialisés ({"k":"aaa…"}), font exactement {@code length} caractères. */
    private static String withMetadataOfLength(int length) {
        String padding = "a".repeat(length - "{\"k\":\"\"}".length());
        return "{\"gameSlug\": \"clicker\", \"score\": 1, \"metadata\": {\"k\": \"" + padding + "\"}}";
    }

    @Test
    void theValidatorOfTheGameCanRefuseTheScore() throws Exception {
        ScoreValidator clicker = mock(ScoreValidator.class);
        when(clicker.gameSlug()).thenReturn("clicker");
        doThrow(new ApiException(HttpStatus.BAD_REQUEST, "Partie introuvable."))
                .when(clicker)
                .validate(eq(PLAYER), eq(120L), any());

        mvc(clicker)
                .perform(submit("""
                        {"gameSlug": "clicker", "score": 120}""").session(signedInSession()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Partie introuvable."));

        verify(supabase, never()).insert(anyString(), anyString(), anyLong(), any());
    }

    @Test
    void theValidatorOfAnotherGameIsNotCalled() throws Exception {
        ScoreValidator sudoku = mock(ScoreValidator.class);
        when(sudoku.gameSlug()).thenReturn("sudoku");

        mvc(sudoku).perform(submit("""
                        {"gameSlug": "clicker", "score": 120}""").session(signedInSession())).andExpect(status().isNoContent());

        verify(sudoku, never()).validate(any(), anyLong(), any());
        verify(supabase).insert("u-1", "clicker", 120, json("{}"));
    }

    @Test
    void forwardsTheRefusalOfTheDatabase() throws Exception {
        doThrow(new ApiException(HttpStatus.FORBIDDEN, SupabaseScoresClient.CLOSED_GAME))
                .when(supabase)
                .insert(anyString(), anyString(), anyLong(), any());

        mvc().perform(submit("""
                        {"gameSlug": "clicker", "score": 120}""").session(signedInSession()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value(SupabaseScoresClient.CLOSED_GAME));
    }
}
