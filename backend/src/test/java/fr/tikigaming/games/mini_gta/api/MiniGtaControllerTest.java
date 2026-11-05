package fr.tikigaming.games.mini_gta.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.tikigaming.config.ApiExceptionHandler;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@DisplayName("API MiniGTA")
class MiniGtaControllerTest {

    static final String NEW_GAME = """
            {"version": 1, "money": 500, "totalEarned": 0, "armor": 0, "inventory": null,
             "completedMissions": [], "stats": {"kills": 0, "wantedMax": 0, "playTime": 0}}""";

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new MiniGtaController(new MiniGtaWorld(TinyCity::create, 7)))
                .setControllerAdvice(new ApiExceptionHandler())
                .defaultResponseCharacterEncoding(StandardCharsets.UTF_8)
                .build();
    }

    private ResultActions postJson(String path, String json) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private static String progress(int money) {
        return NEW_GAME.replace("\"money\": 500", "\"money\": " + money);
    }

    @Nested
    class Catalogue {
        @Test
        void serLaVilleAuFormatDuFront() throws Exception {
            mvc.perform(get("/api/games/mini-gta/world"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.seed").value(7))
                    .andExpect(jsonPath("$.terrain.n").value(512))
                    .andExpect(jsonPath("$.roads.edges", hasSize(4)))
                    .andExpect(jsonPath("$.locations.missionGivers", hasSize(4)));
        }

        @Test
        void serLesMissions() throws Exception {
            mvc.perform(get("/api/games/mini-gta/missions"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(4)))
                    .andExpect(jsonPath("$[0].id").value("express"))
                    .andExpect(jsonPath("$[0].steps[0].type").value("goto"));
        }

        @Test
        void serLesArmes() throws Exception {
            mvc.perform(get("/api/games/mini-gta/weapons"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.pistol.price").value(300))
                    .andExpect(jsonPath("$.grenade.thrown").value(true));
        }

        @Test
        void calculeUnItineraireJusquALaDestinationExacte() throws Exception {
            mvc.perform(get("/api/games/mini-gta/route")
                            .param("fromX", "0")
                            .param("fromZ", "0")
                            .param("toX", "200")
                            .param("toZ", "190"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].x").value(0))
                    .andExpect(jsonPath("$[-1].x").value(200))
                    .andExpect(jsonPath("$[-1].z").value(190));
        }

        @ParameterizedTest
        @ValueSource(strings = {"abc", "NaN", "Infinity"})
        void refuseUneCoordonneeInvalide(String value) throws Exception {
            mvc.perform(get("/api/games/mini-gta/route")
                            .param("fromX", value)
                            .param("fromZ", "0")
                            .param("toX", "0")
                            .param("toZ", "0"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void refuseUnItineraireSansDestination() throws Exception {
            mvc.perform(get("/api/games/mini-gta/route").param("fromX", "0").param("fromZ", "0"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Requête invalide."));
        }
    }

    @Nested
    class Missions {
        @Test
        void payeLaRecompenseEtRenvoieLaProgression() throws Exception {
            postJson("/api/games/mini-gta/missions/port/complete", "{\"progress\": " + NEW_GAME + "}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.rewarded").value(true))
                    .andExpect(jsonPath("$.reward").value(2500))
                    .andExpect(jsonPath("$.progress.money").value(3000))
                    .andExpect(jsonPath("$.progress.totalEarned").value(2500))
                    .andExpect(jsonPath("$.progress.completedMissions[0]").value("port"))
                    .andExpect(jsonPath("$.progress.inventory").doesNotExist());
        }

        @Test
        void neRepayePasUneMissionDejaTerminee() throws Exception {
            String done = NEW_GAME.replace("\"completedMissions\": []", "\"completedMissions\": [\"port\"]");
            postJson("/api/games/mini-gta/missions/port/complete", "{\"progress\": " + done + "}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.rewarded").value(false))
                    .andExpect(jsonPath("$.progress.money").value(500));
        }

        @Test
        void refuseUneMissionInconnue() throws Exception {
            postJson("/api/games/mini-gta/missions/inexistante/complete", "{\"progress\": " + NEW_GAME + "}")
                    .andExpect(status().isNotFound());
        }

        @Test
        void refuseUneRequeteSansProgression() throws Exception {
            postJson("/api/games/mini-gta/missions/port/complete", "{}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fields.progress").value("Progression attendue."));
        }

        @Test
        void refuseUneProgressionDUnAutreFormat() throws Exception {
            String old = NEW_GAME.replace("\"version\": 1", "\"version\": 2");
            postJson("/api/games/mini-gta/missions/port/complete", "{\"progress\": " + old + "}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Sauvegarde d'un format inconnu."));
        }

        @Test
        void refuseUneProgressionIncoherente() throws Exception {
            String bad = NEW_GAME.replace("\"armor\": 0", "\"armor\": 150")
                    .replace("\"inventory\": null", "\"inventory\": [{\"id\": \"laser\", \"clip\": 0, \"ammo\": -1}]");
            postJson("/api/games/mini-gta/missions/port/complete", "{\"progress\": " + bad + "}")
                    .andExpect(status().isBadRequest())
                    .andExpect(
                            jsonPath("$.fields['progress.armor']").value("L'armure doit être comprise entre 0 et 100."))
                    .andExpect(jsonPath("$.fields['progress.inventory[0].id']").value("Arme inconnue."));
        }

        @Test
        void refuseUnCorpsIllisible() throws Exception {
            postJson("/api/games/mini-gta/missions/port/complete", "{pas du json")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Requête invalide."));
        }
    }

    @Nested
    class Armurerie {
        @Test
        void vendUneArmeEtRenvoieLesMunitions() throws Exception {
            postJson(
                            "/api/games/mini-gta/shop/purchase",
                            "{\"progress\": " + progress(1000) + ", \"item\": \"weapon\", \"weapon\": \"pistol\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.ok").value(true))
                    .andExpect(jsonPath("$.price").value(300))
                    .andExpect(jsonPath("$.rounds").value(24))
                    .andExpect(jsonPath("$.progress.money").value(700))
                    .andExpect(jsonPath("$.progress.totalEarned").value(0));
        }

        @Test
        void vendUnGiletSansArme() throws Exception {
            postJson("/api/games/mini-gta/shop/purchase", "{\"progress\": " + NEW_GAME + ", \"item\": \"armor\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.ok").value(true))
                    .andExpect(jsonPath("$.progress.money").value(250));
        }

        @Test
        void refuseSansDebitQuandLeSoldeNeSuffitPas() throws Exception {
            postJson(
                            "/api/games/mini-gta/shop/purchase",
                            "{\"progress\": " + progress(100) + ", \"item\": \"weapon\", \"weapon\": \"sniper\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.ok").value(false))
                    .andExpect(jsonPath("$.price").value(2500))
                    .andExpect(jsonPath("$.progress.money").value(100));
        }

        @Test
        void refuseUnArticleNonVendu() throws Exception {
            postJson(
                            "/api/games/mini-gta/shop/purchase",
                            "{\"progress\": " + NEW_GAME + ", \"item\": \"ammo\", \"weapon\": \"bat\"}")
                    .andExpect(status().isBadRequest());
        }

        @Test
        void refuseUnArticleInconnu() throws Exception {
            postJson(
                            "/api/games/mini-gta/shop/purchase",
                            "{\"progress\": " + NEW_GAME + ", \"item\": \"tank\", \"weapon\": \"bazooka\"}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fields.item").value("Article inconnu."))
                    .andExpect(jsonPath("$.fields.weapon").value("Arme inconnue."));
        }
    }

    @Nested
    class Reapparition {
        @Test
        void preleveLesFraisDHopital() throws Exception {
            postJson("/api/games/mini-gta/respawn", "{\"progress\": " + progress(5000) + ", \"reason\": \"dead\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.fee").value(500))
                    .andExpect(jsonPath("$.progress.money").value(4500));
        }

        @Test
        void preleveLaCaution() throws Exception {
            postJson("/api/games/mini-gta/respawn", "{\"progress\": " + progress(10000) + ", \"reason\": \"busted\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.fee").value(1500));
        }

        @Test
        void refuseUnMotifInconnu() throws Exception {
            postJson("/api/games/mini-gta/respawn", "{\"progress\": " + NEW_GAME + ", \"reason\": \"bored\"}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fields.reason").value("Motif de réapparition inconnu."));
        }
    }
}
