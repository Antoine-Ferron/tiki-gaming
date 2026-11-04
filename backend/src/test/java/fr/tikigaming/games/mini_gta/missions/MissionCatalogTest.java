package fr.tikigaming.games.mini_gta.missions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.tikigaming.games.mini_gta.world.Location;
import fr.tikigaming.games.mini_gta.world.Locations;
import java.util.HashSet;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("MissionCatalog : les quatre missions de l'histoire")
class MissionCatalogTest {

    /** Lieux fictifs : chaque point est reconnaissable à sa coordonnée x. */
    static Locations locations(Location pickup, Location delivery) {
        Location p = new Location(0, 0, 0);
        return new Locations(
                p,
                p,
                p,
                new Location(70, 0, 7, 0.0),
                p,
                p,
                new Location(60, 0, 6),
                p,
                p,
                p,
                p,
                p,
                List.of(new Location(1, 0, 1), new Location(2, 0, 2), new Location(3, 0, 3), new Location(4, 0, 4)),
                List.of(pickup, delivery, new Location(90, 0, 9)));
    }

    static final List<MissionDef> DEFS =
            MissionCatalog.story(locations(new Location(0, 0, 0), new Location(110, 0, 0)));

    static MissionDef def(String id) {
        return DEFS.stream().filter(d -> d.id().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void quatreMissionsAuxIdentifiantsUniques() {
        assertEquals(
                List.of("express", "chase", "port", "special"),
                DEFS.stream().map(MissionDef::id).toList());
        assertEquals(4, new HashSet<>(DEFS.stream().map(MissionDef::title).toList()).size());
    }

    @Test
    void lesRecompensesCroissentAvecLaDifficulte() {
        assertEquals(
                List.of(800, 1500, 2500, 3000),
                DEFS.stream().map(MissionDef::reward).toList());
    }

    @Test
    void chaqueMissionALeDonneurQuiLuiCorrespond() {
        for (int i = 0; i < 4; i++) {
            assertEquals(new Pos(i + 1, i + 1), DEFS.get(i).giver());
        }
    }

    @Test
    void colisExpressSeFaitEnVehiculePuisContreLaMontre() {
        List<Step> steps = def("express").steps();
        assertEquals(new Step.Goto("Récupère le colis (en véhicule)", new Pos(0, 0), 5, true, false), steps.get(0));
        Step.Deliver d = (Step.Deliver) steps.get(1);
        assertEquals(new Pos(110, 0), d.pos());
        assertEquals(6, d.radius());
        assertEquals(45.0, d.timeLimit()); // 110 / 11 + 35
    }

    @ParameterizedTest(name = "trajet de {0} m -> {1} s")
    @CsvSource({
        "0, 35",
        "505.99, 81", // 46,999 + 35 = 80,999 -> 81
        "500.5, 81", // 45,5 + 35 = 80,5 : l'arrondi se fait au supérieur
        "500.49, 80",
    })
    void leChronoDuColisDependDeLaDistance(double distance, double expected) {
        MissionDef express = MissionCatalog.story(locations(new Location(0, 0, 0), new Location(distance, 0, 0)))
                .get(0);
        assertEquals(expected, ((Step.Deliver) express.steps().get(1)).timeLimit());
    }

    @Test
    void contratAuPortEliminerPuisSemerLaPolice() {
        List<Step> steps = def("port").steps();
        assertEquals(new Pos(60, 6), ((Step.Goto) steps.get(0)).pos());
        assertEquals(new Step.Eliminate("Élimine le trafiquant", List.of("boss")), steps.get(1));
        assertTrue(steps.get(2) instanceof Step.Escape);
    }

    @Test
    void commandeSpecialeRamenerLaVoitureAuGarage() {
        List<Step> steps = def("special").steps();
        assertEquals("special", ((Step.EnterVehicle) steps.get(0)).tag());
        assertTrue(steps.get(1) instanceof Step.Escape);
        Step.Deliver d = (Step.Deliver) steps.get(2);
        assertEquals(new Pos(70, 7), d.pos());
        assertEquals("special", d.requireTag());
    }

    @Test
    void laFuiteDetruireLaVoitureDeLaCible() {
        assertEquals(
                List.of(new Step.Destroy("Arrête la voiture de la cible", "target")),
                def("chase").steps());
    }

    @Test
    void lesTextesSontEnFrancaisEtNonVides() {
        for (MissionDef d : DEFS) {
            assertTrue(!d.brief().isBlank() && !d.title().isBlank());
            for (Step s : d.steps()) assertTrue(!s.text().isBlank());
        }
    }

    @Test
    void leChronoSeCalculeEntreLesDeuxPointsQuelleQueSoitLeurPosition() {
        MissionDef express = MissionCatalog.story(locations(new Location(100, 0, 200), new Location(166, 0, 288)))
                .get(0);
        assertEquals(45.0, ((Step.Deliver) express.steps().get(1)).timeLimit()); // distance 110
    }
}
