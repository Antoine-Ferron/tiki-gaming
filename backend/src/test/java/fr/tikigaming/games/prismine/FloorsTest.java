package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.prismine.Engine.Outcome;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/**
 * TU — génération des étages. Test de propriétés sur 400 étages à graines fixes : un échec est toujours
 * reproductible.
 */
class FloorsTest {

    private static final List<Floors.Floor> SAMPLES = IntStream.range(0, 400)
            .mapToObj(i -> Floors.generate(1 + i % 8, Integer.toUnsignedLong(i * 0x9E3779B1)))
            .toList();

    @Test
    void generatesDeterministicSolvableFloorsWithReversibleBeams() {
        for (Floors.Floor floor : SAMPLES) {
            // Décompte annoncé = celui de l'étage généré (identique au palier, sauf pièces hors de portée retirées).
            Floors.Spec spec = floor.spec();
            assertThat(spec.prisms() + spec.obsidians())
                    .isLessThanOrEqualTo(Floors.spec(floor.depth()).prisms()
                            + Floors.spec(floor.depth()).obsidians());
            int size = spec.size();
            // Même profondeur et même graine : même étage, avec les pièces prévues.
            assertThat(Floors.generate(floor.depth(), floor.seed())).isEqualTo(floor);
            List<Engine.Prism> prisms = floor.grid()
                    .chars()
                    .mapToObj(c -> Engine.prismOf((char) c))
                    .filter(p -> p != null)
                    .toList();
            assertThat(prisms)
                    .hasSize(spec.prisms())
                    .allMatch(p -> spec.colors().contains(p.color()));
            assertThat(floor.grid().chars().filter(c -> c == '#')).hasSize(spec.obsidians());

            Set<Integer> touched = new HashSet<>();
            for (int entry = 0; entry < Engine.entryCount(size); entry++) {
                for (int[] cell : Engine.path(floor.grid(), size, entry)) {
                    if (cell[0] >= 0 && cell[1] >= 0 && cell[0] < size && cell[1] < size) {
                        touched.add(cell[0] * size + cell[1]);
                    }
                }
                // Trajet réversible : même nombre de rebonds et même couleur dans l'autre sens.
                Outcome there = Engine.trace(floor.grid(), size, entry);
                if (there.exit() != null) {
                    assertThat(Engine.trace(floor.grid(), size, there.exit()))
                            .isEqualTo(new Outcome(entry, there.bounces(), there.color()));
                }
            }
            // Aucune pièce cachée hors de portée de la lumière.
            for (int cell = 0; cell < floor.grid().length(); cell++) {
                if (floor.grid().charAt(cell) != '.') assertThat(touched).contains(cell);
            }
        }
    }
}
