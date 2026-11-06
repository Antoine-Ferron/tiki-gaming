package fr.tikigaming.games.prismine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.auth.AuthUser;
import fr.tikigaming.config.ApiException;
import fr.tikigaming.games.prismine.Expedition.Verdict;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.node.JsonNodeFactory;

/**
 * Traduit les phrases de {@code expedition.feature} en appels au domaine pur, sans navigateur ni base. Aucune règle
 * ici : la « colle » relie le langage du métier (Gherkin) à {@link Expedition}, testée par ailleurs en unitaire.
 */
public class ExpeditionSteps {

    private static final Instant NOW = Instant.parse("2026-11-03T10:00:00Z");
    private static final int PRISM_CELL = 2 * 6 + 3;
    private static final Map<String, Integer> ENTRIES = Map.of("Haut D", 3, "Gauche 3", 21);
    private static final Map<String, Integer> COLORS = Map.of("rouge", Engine.RED);

    private final PrismineScoreValidator scoreValidator = new PrismineScoreValidator();
    private Floors.Floor floor;
    private Run run;
    private ApiException refusal;
    private Verdict verdict;
    private long declaredScore;

    @Given("une galerie dont la seule pièce est un prisme rouge")
    public void uneGalerieDontLaSeulePieceEstUnPrismeRouge() {
        String grid = Engine.withPiece(Engine.emptyGrid(6), PRISM_CELL, Engine.prism(Engine.RED, Engine.SE));
        floor = new Floors.Floor(1, 1, new Floors.Spec(6, 1, 0, List.of(Engine.RED)), grid);
    }

    @Given("une expédition avec {int} dose(s) d'huile")
    public void uneExpeditionAvecDesDosesDHuile(int oil) {
        run = newRun().withOil(oil);
    }

    @Given("une expédition à l'étage {int} avec {int} erreur(s) sur cet étage")
    public void uneExpeditionALEtage(int depth, int errors) {
        run = newRun().toBuilder().depth(depth).floorErrors(errors).build();
    }

    @Given("j'ai déjà tiré depuis {string}")
    public void jaiDejaTireDepuis(String entry) {
        run = Expedition.fire(run, floor, ENTRIES.get(entry));
    }

    @When("je tire depuis {string}")
    public void jeTireDepuis(String entry) {
        try {
            run = Expedition.fire(run, floor, ENTRIES.get(entry));
        } catch (ApiException e) {
            refusal = e;
        }
    }

    @When("je valide une carte fausse")
    public void jeValideUneCarteFausse() {
        validate(Engine.emptyGrid(6));
    }

    @When("je valide une carte avec un prisme de la mauvaise couleur")
    public void jeValideUneCarteAvecUnPrismeDeLaMauvaiseCouleur() {
        validate(Engine.withPiece(Engine.emptyGrid(6), PRISM_CELL, Engine.prism(Engine.BLUE, Engine.SE)));
    }

    @When("je valide la bonne carte")
    public void jeValideLaBonneCarte() {
        validate(floor.grid());
    }

    @When("je déclare moi-même un score de {int} point(s)")
    public void jeDeclareMoiMemeUnScore(int score) {
        declaredScore = score;
    }

    @Then("il me reste {int} dose(s) d'huile")
    public void ilMeResteDesDosesDHuile(int oil) {
        assertThat(run.oil()).isEqualTo(oil);
    }

    @Then("le faisceau ressort en {string} avec la couleur {string}")
    public void leFaisceauRessortEn(String exit, String color) {
        Engine.Outcome outcome =
                Expedition.results(run.probes(), floor).getLast().outcome();
        assertThat(outcome.exit()).isEqualTo(ENTRIES.get(exit));
        assertThat(outcome.color()).isEqualTo(COLORS.get(color));
    }

    @Then("le tir est refusé : {string}")
    public void leTirEstRefuseAvecLeMessage(String message) {
        assertThat(refusal).hasMessage(message);
    }

    @Then("le tir est {word}")
    public void leTirEst(String issue) {
        if (issue.equals("accepté")) {
            assertThat(refusal).isNull();
        } else {
            assertThat(refusal).isNotNull();
        }
    }

    @Then("l'expédition se termine")
    public void lExpeditionSeTermine() {
        assertThat(verdict).isInstanceOf(Verdict.LampOut.class);
        assertThat(run.over()).isTrue();
    }

    @Then("l'expédition continue")
    public void lExpeditionContinue() {
        assertThat(verdict).isInstanceOf(Verdict.Wrong.class);
        assertThat(run.over()).isFalse();
    }

    @Then("ma carte contredit le tir {int}")
    public void maCarteContreditLeTir(int probe) {
        assertThat(verdict).isEqualTo(new Verdict.Contradiction(List.of(probe - 1)));
    }

    @Then("je gagne {int} point(s)")
    public void jeGagneDesPoints(int points) {
        assertThat(verdict)
                .isInstanceOfSatisfying(
                        Verdict.Cleared.class,
                        cleared -> assertThat(cleared.points()).isEqualTo(points));
    }

    @Then("je descends à l'étage {int}")
    public void jeDescendsALEtage(int depth) {
        assertThat(run.depth()).isEqualTo(depth);
    }

    @Then("mon score est refusé")
    public void monScoreEstRefuse() {
        AuthUser player = new AuthUser("joueur-1", "joueur@example.com");
        assertThatThrownBy(() -> scoreValidator.validate(player, declaredScore, JsonNodeFactory.instance.objectNode()))
                .isInstanceOfSatisfying(
                        ApiException.class, e -> assertThat(e.status()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    private static Run newRun() {
        return Expedition.start(UUID.randomUUID(), "joueur-1", 1, NOW);
    }

    /** Applique le verdict à l'expédition : seul le suivant de {@code Contradiction} la laisse inchangée. */
    private void validate(String guess) {
        verdict = Expedition.validate(run, floor, guess, 99, 0, NOW.plusSeconds(60));
        run = switch (verdict) {
            case Verdict.Cleared cleared -> cleared.next();
            case Verdict.Wrong wrong -> wrong.next();
            case Verdict.LampOut out -> out.run();
            case Verdict.Contradiction ignored -> run;
        };
    }
}
