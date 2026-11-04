package fr.tikigaming.games.sdv_civilisation.api;

import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.JSON;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.JWT_SECRET;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.SERVICE_KEY;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.SUPABASE_URL;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.props;
import static fr.tikigaming.games.sdv_civilisation.api.Fixtures.saved;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import fr.tikigaming.games.sdv_civilisation.ScoreBreakdown;
import java.net.URLDecoder;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Intégration avec l'API REST de Supabase (PostgREST) : vrai client HTTP de Spring, vraie sérialisation JSON et
 * vrai chiffrement. Seul Supabase est simulé (MockRestServiceServer) : aucun appel réseau, aucun test flaky,
 * aucune donnée de production touchée.
 */
class SupabaseGamesIntegrationTest {

    private static final String USER = "6f1c0d2e-0000-4000-8000-000000000001";
    private static final String ROW = "/rest/v1/game_saves?user_id=eq." + USER + "&game_slug=eq.sdv-civilisation";

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer supabase =
            MockRestServiceServer.bindTo(builder).build();
    private final SealedState sealer = new SealedState(props(JWT_SECRET), JSON);
    private final SupabaseGames games =
            new SupabaseGames(SdvCivilisationConfig.supabase(builder, props(JWT_SECRET)), sealer);
    private final GameStore store = games.forUser(USER);

    @AfterEach
    void everyExpectedCallWasMade() {
        supabase.verify();
    }

    private String row(SavedGame game) {
        return JSON.writeValueAsString(
                new Object[] {Map.of("data", Map.of("version", game.version(), "sealed", sealer.seal(game)))});
    }

    @Test
    void readsBackTheSealedGameOfThePlayerWithTheServiceKey() {
        // Étant donné la ligne game_saves du joueur, scellée par le serveur
        supabase.expect(requestTo(SUPABASE_URL + ROW + "&select=data"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("apikey", SERVICE_KEY))
                .andExpect(header("Authorization", "Bearer " + SERVICE_KEY))
                .andRespond(withSuccess(row(saved(4)), MediaType.APPLICATION_JSON));

        // Quand le serveur charge sa partie
        // Alors il la retrouve à l'identique
        assertThat(store.load()).contains(saved(4));
    }

    @Test
    void noRowOrAnUnreadableRowMeansNoGameToResume() {
        // Étant donné aucune ligne, puis une ligne modifiée à la main par le joueur
        supabase.expect(requestTo(startsWith(SUPABASE_URL + ROW)))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        supabase.expect(requestTo(startsWith(SUPABASE_URL + ROW)))
                .andRespond(
                        withSuccess("[{\"data\":{\"version\":9,\"sealed\":\"triche\"}}]", MediaType.APPLICATION_JSON));

        // Alors il n'y a pas de partie à reprendre
        assertThat(store.load()).isEmpty();
        assertThat(store.load()).isEmpty();
    }

    @Test
    void aNewGameReplacesTheRowOfThePlayer() {
        // Quand le joueur commence une nouvelle partie
        supabase.expect(requestTo(SUPABASE_URL + "/rest/v1/game_saves?on_conflict=user_id,game_slug"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Prefer", "resolution=merge-duplicates,return=minimal"))
                .andExpect(jsonPath("$.user_id").value(USER))
                .andExpect(jsonPath("$.game_slug").value("sdv-civilisation"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andRespond(withStatus(HttpStatus.CREATED));

        // Alors la ligne est créée ou remplacée (upsert), en version 1
        store.save(saved(1), 0);
    }

    @Test
    void theNextTurnIsSavedOnlyIfTheRowIsStillAtTheExpectedVersion() {
        // Étant donné une ligne encore en version 1, qui n'est plus en version 2 au second envoi
        supabase.expect(requestTo(startsWith(SUPABASE_URL + ROW)))
                .andExpect(method(HttpMethod.PATCH))
                // Filtre PostgREST sur la version dans le JSON (encodé dans l'URL, décodé par Supabase)
                .andExpect(
                        request -> assertThat(URLDecoder.decode(request.getURI().getRawQuery(), UTF_8))
                                .endsWith("&data->>version=eq.1"))
                .andExpect(header("Prefer", "return=representation"))
                .andExpect(jsonPath("$.data.version").value(2))
                .andRespond(withSuccess(row(saved(2)), MediaType.APPLICATION_JSON));
        supabase.expect(requestTo(startsWith(SUPABASE_URL + ROW)))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        // Quand le serveur enregistre le tour 2 d'une partie en version 1
        // Alors la ligne est mise à jour
        store.save(saved(2), 1);
        // Mais si la ligne a déjà changé (aucune ligne modifiée), l'enregistrement est refusé
        assertThatThrownBy(() -> store.save(saved(3), 2)).isInstanceOf(StaleGameException.class);
    }

    @Test
    void abandoningDeletesTheRowOfThePlayer() {
        // Quand le joueur abandonne
        supabase.expect(requestTo(SUPABASE_URL + ROW))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withStatus(HttpStatus.NO_CONTENT));

        // Alors sa ligne game_saves est supprimée
        store.clear();
    }

    @Test
    void theFinalScoreIsInsertedWithItsBreakdown() {
        // Quand un joueur connecté termine une partie avec 28 points
        supabase.expect(requestTo(SUPABASE_URL + "/rest/v1/scores"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("apikey", SERVICE_KEY))
                .andExpect(content().json("""
                        {"user_id": "%s", "game_slug": "sdv-civilisation", "score": 28,
                         "metadata": {"military": 4, "treasury": 3, "wonder": 3, "civil": 8, "science": 10,
                                      "guilds": 0, "total": 28}}""".formatted(USER)))
                .andRespond(withStatus(HttpStatus.CREATED));

        // Alors son score part au classement de la plateforme, avec le détail par catégorie
        games.record(USER, new ScoreBreakdown(4, 3, 3, 8, 10, 0, 28));
    }
}
