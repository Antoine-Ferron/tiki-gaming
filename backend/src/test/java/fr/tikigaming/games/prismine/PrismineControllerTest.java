package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiExceptionHandler;
import fr.tikigaming.games.prismine.TestDoubles.InMemoryRunRepository;
import fr.tikigaming.games.prismine.TestDoubles.InMemoryScoreRegistry;
import fr.tikigaming.games.prismine.TestDoubles.MutableClock;
import fr.tikigaming.games.prismine.TestDoubles.StubSeedSource;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;

/**
 * TI — API HTTP de Prismine : contrôleur, vrai service, gestion des erreurs de la plateforme et session, branchés sur
 * les faux en mémoire (MockMvc, sans serveur ni Supabase).
 */
class PrismineControllerTest {

    private static final String BASE = "/api/games/prismine/runs";
    private static final long SEED = 42;

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-03T10:00:00Z"));
    private final InMemoryScoreRegistry scores = new InMemoryScoreRegistry();
    private final MockHttpSession session = new MockHttpSession();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        PrismineService service = new PrismineService(
                new InMemoryRunRepository(clock),
                scores,
                mock(AuditNotifier.class),
                new StubSeedSource(SEED, 7),
                clock);
        mvc = MockMvcBuilders.standaloneSetup(new PrismineController(service, new StartLimiter(clock)))
                .setControllerAdvice(new ApiExceptionHandler())
                .defaultResponseCharacterEncoding(StandardCharsets.UTF_8)
                .build();
        session.setAttribute("tiki.user", new AuthUser("joueur-1", "joueur@example.com"));
    }

    private ResultActions postJson(String path, String body) throws Exception {
        return mvc.perform(post(path)
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private String start() throws Exception {
        String body = postJson(BASE, "{}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.depth").value(1))
                .andExpect(jsonPath("$.oil").value(Expedition.START_OIL))
                // La carte cachée et sa graine ne quittent jamais le serveur.
                .andExpect(jsonPath("$.grid").doesNotExist())
                .andExpect(jsonPath("$.seed").doesNotExist())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return new ObjectMapper().readTree(body).get("id").asString();
    }

    @Test
    void playsAFullExpeditionAndRecordsTheScore() throws Exception {
        String id = start();
        postJson(BASE + "/" + id + "/probes", "{\"entry\": 0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.oil").value(Expedition.START_OIL - 1))
                .andExpect(jsonPath("$.probes", hasSize(1)));
        postJson(BASE + "/" + id + "/probes", "{\"entry\": 0}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Ce bord a déjà été exploré : regarde le journal."));

        String solution = Floors.generate(1, SEED).grid();
        clock.advance(Duration.ofMinutes(1));
        postJson(BASE + "/" + id + "/validation", "{\"guess\": \"" + solution + "\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("cleared"))
                .andExpect(jsonPath("$.points").value(150))
                .andExpect(jsonPath("$.floor.grid").value(solution))
                .andExpect(jsonPath("$.run.depth").value(2));

        postJson(BASE + "/" + id + "/end", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recorded").value(true))
                .andExpect(jsonPath("$.run.score").value(150));
        assertThat(scores.recorded()).hasSize(1);
        mvc.perform(get(BASE + "/" + id).session(session))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Cette expédition n'existe plus : commences-en une nouvelle."));
    }

    @Test
    void refusesAnUnreadableMapAnotherPlayersRunAndTooManyStarts() throws Exception {
        String id = start();
        postJson(BASE + "/" + id + "/validation", "{\"guess\": \"//\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.guess").value("La carte contient une pièce inconnue."));

        MockHttpSession other = new MockHttpSession();
        other.setAttribute("tiki.user", new AuthUser("joueur-2", "autre@example.com"));
        mvc.perform(get(BASE + "/" + id).session(other)).andExpect(status().isNotFound());

        // Limite de démarrages par adresse : la suivante est refusée (429), puis acceptée une fois la fenêtre passée.
        for (int n = 1; n < StartLimiter.MAX_STARTS; n++) start();
        postJson(BASE, "{}")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value(StartLimiter.TOO_MANY));
        clock.advance(StartLimiter.WINDOW);
        start();
    }
}
