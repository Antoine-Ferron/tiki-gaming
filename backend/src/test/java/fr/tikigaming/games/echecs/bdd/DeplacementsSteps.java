package fr.tikigaming.games.echecs.bdd;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.echecs.engine.Fen;
import fr.tikigaming.games.echecs.engine.MoveGenerator;
import fr.tikigaming.games.echecs.engine.Position;
import fr.tikigaming.games.echecs.engine.Square;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Traduit les phrases de {@code deplacements.feature} en appels au moteur. Aucune règle ici : la « colle » ne fait que
 * relier le langage du métier (Gherkin) au code, testé par ailleurs en TDD.
 */
public class DeplacementsSteps {

    private Position position;
    private Set<Square> destinations;

    @Given("la position {string}")
    public void laPosition(String fen) {
        position = Fen.parse(fen);
    }

    @When("je regarde les cases accessibles depuis {string}")
    public void jeRegardeLesCasesAccessiblesDepuis(String square) {
        destinations = MoveGenerator.destinations(position, Square.of(square));
    }

    @Then("les cases accessibles sont {string}")
    public void lesCasesAccessiblesSont(String expected) {
        Set<Square> squares = Arrays.stream(expected.split(","))
                .map(String::trim)
                .map(Square::of)
                .collect(Collectors.toSet());
        assertThat(destinations).isEqualTo(squares);
    }

    @Then("aucune case n'est accessible")
    public void aucuneCaseNEstAccessible() {
        assertThat(destinations).isEmpty();
    }
}
