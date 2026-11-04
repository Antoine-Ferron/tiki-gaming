package fr.tikigaming.games.mini_gta.api;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.mini_gta.world.Vec2;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Ville unique de MiniGTA")
class MiniGtaWorldTest {

    private int generated;
    private long requestedSeed;
    private MiniGtaWorld world;

    @BeforeEach
    void setUp() {
        world = new MiniGtaWorld(
                seed -> {
                    generated++;
                    requestedSeed = seed;
                    return TinyCity.create(seed);
                },
                7);
    }

    @Test
    void laVilleNEstGenereeQuUneFoisPourTousLesAppels() {
        Object first = world.worldJson();

        world.missionsJson();
        world.mission("port");
        world.route(0, 0, 200, 190);

        assertThat(world.worldJson()).isSameAs(first);
        assertThat(generated).isEqualTo(1);
        assertThat(requestedSeed).isEqualTo(7);
    }

    @Test
    void laGraineDeProductionEstCelleDuPrototype() {
        assertThat(MiniGtaWorld.SEED).isEqualTo(1337);
    }

    @Test
    void leCatalogueUtiliseLesLieuxDeLaVille() {
        assertThat(world.missionsJson())
                .extracting(m -> m.get("id"))
                .containsExactly("express", "chase", "port", "special");
        assertThat(world.mission("port"))
                .hasValueSatisfying(m -> assertThat(m.reward()).isEqualTo(2500));
        assertThat(world.mission("inexistante")).isEmpty();
    }

    @Test
    void lItineraireSuitLesRoutesJusquALaDestination() {
        List<Vec2> route = world.route(0, 0, 200, 190);

        assertThat(route.getFirst()).isEqualTo(new Vec2(0, 0));
        assertThat(route.get(route.size() - 2)).isEqualTo(new Vec2(200, 200));
        assertThat(route.getLast()).isEqualTo(new Vec2(200, 190));
    }

    @Test
    void uneDestinationLoinDeToutRouteDonneUnTrajetDirect() {
        assertThat(world.route(0, 0, 5000, 5000)).containsExactly(new Vec2(5000, 5000));
    }

    @Test
    void unDepartLoinDeToutRouteDonneUnTrajetDirect() {
        assertThat(world.route(5000, 5000, 0, 0)).containsExactly(new Vec2(0, 0));
    }

    @Test
    void sansRouteProcheLItineraireVaDirectementALaDestination() {
        MiniGtaWorld empty = new MiniGtaWorld(seed -> TinyCity.withoutRoads(seed), 7);

        assertThat(empty.route(0, 0, 50, 60)).containsExactly(new Vec2(50, 60));
    }
}
