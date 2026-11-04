package fr.tikigaming.games.mini_gta.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.tikigaming.games.mini_gta.world.CityData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** Contrat JSON appliqué à une ville réellement générée (bâtiments spéciaux, feux, étages). */
@Tag("integration")
@DisplayName("Json : ville complète")
class JsonWorldTest {
    @Test
    void unBatimentSpecialExposeStyleNumeriqueEtageEtPorte() {
        CityData full = fr.tikigaming.games.mini_gta.world.CityGenerator.generate(3);
        JsonNode buildings = JsonTrees.tree(Json.world(full)).get("buildings");
        JsonNode safehouse = null;
        boolean anyTier = false;
        for (JsonNode b : buildings) {
            if ("safehouse".equals(b.path("special").asString())) safehouse = b;
            anyTier |= b.has("tier");
        }
        assertTrue(anyTier);
        assertNotNull(safehouse);
        assertEquals(3, safehouse.get("style").asInt()); // HOUSE
        assertEquals("flat", safehouse.get("roof").asString());
        assertTrue(safehouse.get("hollow").has("doorSide"));
        assertTrue(safehouse.get("lot").has("x0"));
        JsonNode light = null;
        for (JsonNode p : JsonTrees.tree(Json.world(full)).get("props")) {
            if (p.get("kind").asString().equals("trafficLight")) light = p;
        }
        assertNotNull(light);
        assertTrue(light.has("node") && light.has("edge"));
        assertFalse(light.get("destroyed").asBoolean());
    }
}
