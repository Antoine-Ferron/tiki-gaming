package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("Block et Rect : appartenance et dimensions")
class BlockTest {

    static final Block BLOCK = new Block(0, 10, 20, 30, 50, District.SUBURB, false, 0, 0);

    @ParameterizedTest(name = "({0}, {1}) -> strict {2}, inclusif {3}")
    @CsvSource({
        "15, 40, true, true",
        "10, 40, false, true", // bord ouest
        "20, 40, false, true", // bord est
        "15, 30, false, true", // bord nord
        "15, 50, false, true", // bord sud
        "9.999, 40, false, false",
        "20.001, 40, false, false",
        "15, 29.999, false, false",
        "15, 50.001, false, false",
    })
    void appartenanceAuxFrontieres(double x, double z, boolean strict, boolean inclusive) {
        assertEquals(strict, BLOCK.containsStrict(x, z));
        assertEquals(inclusive, BLOCK.containsInclusive(x, z));
    }

    @Test
    void dimensionsDUnRectangle() {
        Rect r = new Rect(10, 25, -5, 3);
        assertEquals(15, r.width());
        assertEquals(8, r.depth());
    }

    @Test
    void codeDeStyleDeFacade() {
        assertEquals(0, FacadeStyle.GLASS_TOWER.code());
        assertEquals(5, FacadeStyle.SHOP.code());
    }
}
