package fr.tikigaming.games.echecs.bdd;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.echecs.api.EchecsRejectedException;
import fr.tikigaming.games.echecs.api.EchecsService;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

/**
 * Traduit les phrases de {@code jouer.feature} en appels au service (la couche que l'API utilisera). Aucune règle
 * ici : la colle relie le langage du joueur au code.
 */
public class JouerSteps {

    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    private final EchecsService service = new EchecsService();
    private String fen;
    private boolean refused;

    @Given("la position de départ")
    public void laPositionDeDepart() {
        fen = START;
    }

    @When("je joue de {string} vers {string}")
    public void jeJoueDeVers(String from, String to) {
        try {
            fen = service.play(fen, from, to);
            refused = false;
        } catch (EchecsRejectedException e) {
            refused = true; // la position ne change pas
        }
    }

    @Then("la position est {string}")
    public void laPositionEst(String expected) {
        assertThat(fen).isEqualTo(expected);
    }

    @Then("le coup est refusé")
    public void leCoupEstRefuse() {
        assertThat(refused).isTrue();
    }
}
