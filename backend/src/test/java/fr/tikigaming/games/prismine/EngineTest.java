package fr.tikigaming.games.prismine;

import static fr.tikigaming.games.prismine.Engine.BLUE;
import static fr.tikigaming.games.prismine.Engine.GREEN;
import static fr.tikigaming.games.prismine.Engine.NE;
import static fr.tikigaming.games.prismine.Engine.NW;
import static fr.tikigaming.games.prismine.Engine.RED;
import static fr.tikigaming.games.prismine.Engine.SE;
import static fr.tikigaming.games.prismine.Engine.SW;
import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.prismine.Engine.Outcome;
import org.junit.jupiter.api.Test;

/** TU — trajet des faisceaux : mêmes règles que frontend/src/games/prismine/engine.ts. */
class EngineTest {

    private static final int SIZE = 6;
    private static final int D3 = 2 * SIZE + 3;
    private static final int B3 = 2 * SIZE + 1;
    private static final int HAUT_D = 3;
    private static final int DROITE_3 = 8;
    private static final int BAS_D = 14;
    private static final int GAUCHE_3 = 21;

    private static String oneCell(char piece) {
        return Engine.withPiece(Engine.emptyGrid(SIZE), D3, piece);
    }

    private static Integer exit(char piece, int entry) {
        return Engine.trace(oneCell(piece), SIZE, entry).exit();
    }

    @Test
    void prismTurnsTheBeamOnItsHypotenuseAndSendsItBackOnItsFlatSides() {
        // Hypoténuse : quart de tour.
        assertThat(exit(Engine.prism(RED, SE), HAUT_D)).isEqualTo(GAUCHE_3);
        assertThat(exit(Engine.prism(RED, SW), HAUT_D)).isEqualTo(DROITE_3);
        assertThat(exit(Engine.prism(RED, NW), BAS_D)).isEqualTo(DROITE_3);
        assertThat(exit(Engine.prism(RED, NE), BAS_D)).isEqualTo(GAUCHE_3);
        // Côtés plats de ◢ (sud, est) : demi-tour.
        assertThat(exit(Engine.prism(RED, SE), BAS_D)).isEqualTo(BAS_D);
        assertThat(exit(Engine.prism(RED, SE), DROITE_3)).isEqualTo(DROITE_3);
        assertThat(Engine.trace(oneCell(Engine.prism(RED, SE)), SIZE, BAS_D).bounces())
                .isEqualTo(1);
    }

    @Test
    void beamStartsWhiteMixesPrismColorsAndIsAbsorbedByObsidian() {
        assertThat(Engine.trace(Engine.emptyGrid(SIZE), SIZE, 2)).isEqualTo(new Outcome(15, 0, 0));
        // Haut D → D3 (◢ rouge) vers l'ouest → B3 (◥ vert) : demi-tour → D3 vers le nord → Haut D.
        String grid = Engine.withPiece(oneCell(Engine.prism(RED, SE)), B3, Engine.prism(GREEN, NE));
        assertThat(Engine.trace(grid, SIZE, HAUT_D)).isEqualTo(new Outcome(HAUT_D, 3, RED | GREEN));
        // Une couleur différente change le résultat du tir, donc le verdict.
        assertThat(Engine.differingEntries(oneCell(Engine.prism(RED, SE)), oneCell(Engine.prism(BLUE, SE)), SIZE))
                .contains(HAUT_D);
        assertThat(Engine.trace(oneCell('#'), SIZE, HAUT_D)).isEqualTo(new Outcome(null, 0, 0));
    }
}
