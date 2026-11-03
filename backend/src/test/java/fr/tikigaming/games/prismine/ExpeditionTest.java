package fr.tikigaming.games.prismine;

import static fr.tikigaming.games.prismine.Engine.BLUE;
import static fr.tikigaming.games.prismine.Engine.RED;
import static fr.tikigaming.games.prismine.Engine.SE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.games.GameException;
import fr.tikigaming.games.prismine.Expedition.Verdict;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * TU — règles d'une expédition (huile, validation, score), en fonctions pures. L'étage est construit à la main (un
 * seul prisme) pour que chaque règle soit lisible ; l'heure et le hasard sont passés en paramètres.
 */
class ExpeditionTest {

    private static final Instant NOW = Instant.parse("2026-11-03T10:00:00Z");
    private static final Instant LATER = NOW.plusSeconds(60);
    private static final int HAUT_D = 3;
    private static final int GAUCHE_3 = 21;

    /** Étage 6 × 6 dont la seule pièce est un prisme rouge ◢ en D3 : depuis Haut D, le faisceau sort en Gauche 3. */
    private static final Floors.Floor ONE_PRISM = new Floors.Floor(
            1,
            1,
            new Floors.Spec(6, 1, 0, List.of(RED)),
            Engine.withPiece(Engine.emptyGrid(6), 2 * 6 + 3, Engine.prism(RED, SE)));

    private static Run newRun() {
        return Expedition.start(UUID.randomUUID(), "joueur-1", 1, NOW);
    }

    private static Verdict validate(Run run, String guess) {
        return Expedition.validate(run, ONE_PRISM, guess, 99, 0, LATER);
    }

    @Test
    void probeCostsOilAndIsRefusedOnAKnownEntryOrWithAnEmptyLamp() {
        Run run = Expedition.fire(newRun(), ONE_PRISM, HAUT_D);
        assertThat(run.oil()).isEqualTo(Expedition.START_OIL - Expedition.PROBE_COST);
        assertThat(Expedition.results(run.probes(), ONE_PRISM))
                .containsExactly(new Expedition.ProbeResult(HAUT_D, false, new Engine.Outcome(GAUCHE_3, 1, RED)));

        // Gauche 3 est connue : c'est la sortie du premier tir.
        assertThatThrownBy(() -> Expedition.fire(run, ONE_PRISM, GAUCHE_3))
                .isInstanceOf(GameException.class)
                .hasMessage("Ce bord a déjà été exploré : regarde le journal.");
        assertThatThrownBy(() -> Expedition.fire(newRun().withOil(0), ONE_PRISM, HAUT_D))
                .isInstanceOf(GameException.class)
                .hasMessage("Ta lampe est vide : valide ta carte ou termine l'expédition.");
    }

    @Test
    void validationClearsChargesContradictsOrPutsTheLampOut() {
        String empty = Engine.emptyGrid(6);

        // Carte juste : étage suivant, 100 × profondeur + 50 % sans erreur, et de l'huile.
        Verdict.Cleared cleared = (Verdict.Cleared) validate(newRun(), ONE_PRISM.grid());
        assertThat(cleared.points()).isEqualTo(150);
        assertThat(cleared.next().depth()).isEqualTo(2);
        assertThat(cleared.next().seed()).isEqualTo(99);
        assertThat(cleared.next().oil()).isEqualTo(Expedition.START_OIL + Expedition.FLOOR_REFILL);
        assertThat(cleared.next().floorStartedAt()).isEqualTo(LATER);

        // Bonne orientation, mauvaise couleur : contredit le tir 1, sans rien coûter.
        String blue = Engine.withPiece(empty, 2 * 6 + 3, Engine.prism(BLUE, SE));
        assertThat(validate(Expedition.fire(newRun(), ONE_PRISM, HAUT_D), blue))
                .isEqualTo(new Verdict.Contradiction(List.of(0)));

        // Carte fausse : un tir révélé contre de l'huile, et plus de bonus sans erreur.
        Verdict.Wrong wrong = (Verdict.Wrong) validate(newRun(), empty);
        assertThat(wrong.next().oil()).isEqualTo(Expedition.START_OIL - Expedition.ERROR_COST);
        assertThat(wrong.next().probes()).containsExactly(new Run.Probe(wrong.entry(), true));
        assertThat(((Verdict.Cleared) validate(wrong.next(), ONE_PRISM.grid())).points())
                .isEqualTo(100);

        // Plus assez d'huile pour payer l'erreur : la lampe s'éteint.
        assertThat(validate(newRun().withOil(Expedition.ERROR_COST - 1), empty)).isInstanceOf(Verdict.LampOut.class);
    }
}
