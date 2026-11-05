package fr.tikigaming.games.mini_gta.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.tikigaming.games.mini_gta.missions.MissionCatalog;
import fr.tikigaming.games.mini_gta.weapons.WeaponId;
import fr.tikigaming.games.mini_gta.world.CityData;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.JsonNode;

@DisplayName("Json : contrat d'échange avec le front")
class JsonTest {

    // @BeforeEach plutôt que @BeforeAll : PIT n'attribue à aucun test le code exécuté dans un @BeforeAll.
    CityData city;
    JsonNode world;

    @BeforeEach
    void arrange() {
        city = TinyCity.create(7);
        world = JsonTrees.tree(Json.world(city));
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
        "STREET, street",
        "TRAFFIC_LIGHT, trafficLight",
        "GLASS_TOWER, glassTower",
        "ENTER_VEHICLE, enterVehicle"
    })
    void lesNomsDEnumSontEnCamelCase(String constant, String json) {
        assertEquals(json, Json.camel(constant));
    }

    @Nested
    class Monde {
        @Test
        void contientLeGrapheRoutier() {
            JsonNode roads = world.get("roads");
            assertEquals(4, roads.get("nodes").size());
            assertEquals(4, roads.get("edges").size());
            JsonNode e1 = roads.get("edges").get(1);
            assertEquals("avenue", e1.get("kind").asString());
            assertEquals(200, e1.get("length").asDouble());
            assertEquals("[0,1]", roads.get("nodes").get(1).get("edges").toString());
            assertEquals("street", roads.get("kindX").get(0).asString());
        }

        @Test
        void contientLesIlotsLesTrottoirsEtLesLieux() {
            assertEquals("suburb", world.get("blocks").get(0).get("district").asString());
            assertEquals(8, world.get("sidewalk").get(0).get("x").asDouble());
            assertEquals(
                    Math.PI, world.get("locations").get("spawn").get("heading").asDouble());
            assertEquals(4, world.get("locations").get("missionGivers").size());
        }

        @Test
        void unCapAbsentEstOmis() {
            assertFalse(world.get("locations").get("safehouseInside").has("heading"));
        }

        @Test
        void leReliefEstUnFloat32PetitBoutisteEnBase64() {
            JsonNode t = world.get("terrain");
            assertEquals(512, t.get("n").asInt());
            byte[] bytes = Base64.getDecoder().decode(t.get("heights").asString());
            assertEquals(513 * 513 * 4, bytes.length);
            float[] heights = new float[513 * 513];
            ByteBuffer.wrap(bytes)
                    .order(ByteOrder.LITTLE_ENDIAN)
                    .asFloatBuffer()
                    .get(heights);
            assertEquals(city.terrain().heights()[1000], heights[1000]);
        }
    }

    @Test
    void lesEtapesDeMissionPortentLeurType() {
        JsonNode missions = JsonTrees.tree(Json.missions(MissionCatalog.story(city.locations())));
        JsonNode express = missions.get(0);
        assertEquals("express", express.get("id").asString());
        assertEquals(800, express.get("reward").asInt());
        JsonNode go = express.get("steps").get(0);
        assertEquals("goto", go.get("type").asString());
        assertTrue(go.get("inVehicle").asBoolean());
        assertFalse(go.has("onFoot"));
        assertEquals("deliver", express.get("steps").get(1).get("type").asString());
        assertFalse(express.get("steps").get(1).has("requireTag"));
        JsonNode special = missions.get(3).get("steps");
        assertEquals("enterVehicle", special.get(0).get("type").asString());
        assertEquals("special", special.get(2).get("requireTag").asString());
        assertEquals(
                "[\"boss\"]", missions.get(2).get("steps").get(1).get("tags").toString());
    }

    @Test
    void lesArmesSontIndexeesParIdentifiant() {
        JsonNode weapons = JsonTrees.tree(Json.weapons());
        assertEquals(7, weapons.size());
        JsonNode shotgun = weapons.get("shotgun");
        assertEquals("shotgun", shotgun.get("id").asString());
        assertEquals("rifle", shotgun.get("holding").asString());
        assertEquals(9, shotgun.get("pellets").asInt());
        assertTrue(weapons.get("grenade").get("thrown").asBoolean());
    }

    @Nested
    class Lecture {
        @ParameterizedTest(name = "\"{0}\" -> {1}")
        @CsvSource({"pistol, PISTOL", "enterVehicle, ", "grenade, GRENADE"})
        void identifiantDArme(String id, WeaponId expected) {
            if (expected == null) assertThrows(IllegalArgumentException.class, () -> Json.weaponId(id));
            else assertEquals(expected, Json.weaponId(id));
        }
    }
}
