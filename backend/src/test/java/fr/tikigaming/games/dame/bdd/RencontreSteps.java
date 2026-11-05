package fr.tikigaming.games.dame.bdd;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.matches.InMemoryMatchRepository;
import fr.tikigaming.games.dame.matches.Match;
import fr.tikigaming.games.dame.matches.MatchService;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

/** Cucumber crée une instance neuve par scénario, donc un nouveau dépôt pour chaque exemple. */
public class RencontreSteps {

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000018");
    private static final Instant START = Instant.parse("2026-11-04T12:00:00Z");
    private static final Instant END = START.plusSeconds(600);

    private final InMemoryMatchRepository repository = new InMemoryMatchRepository();
    private MatchService service = serviceAt(START);
    private String whiteName;
    private String blackName;
    private Match match;
    private Game game;
    private Throwable refusal;

    private MatchService serviceAt(Instant at) {
        return new MatchService(repository, Clock.fixed(at, ZoneOffset.UTC), () -> ID);
    }

    @Given("{string} joue les blancs et {string} joue les noirs")
    public void participants(String white, String black) {
        whiteName = white;
        blackName = black;
    }

    @When("ils démarrent leur rencontre")
    public void startMatch() {
        match = service.start(whiteName, blackName);
    }

    @Then("une rencontre en cours est enregistrée avec ces deux noms")
    public void namesAreStored() {
        assertThat(service.find(ID)).isEqualTo(match);
        assertThat(match.whiteName()).isEqualTo(whiteName);
        assertThat(match.blackName()).isEqualTo(blackName);
        assertThat(match.status()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(match.startedAt()).isEqualTo(START);
    }

    @Then("aucun gagnant n'est encore désigné")
    public void noWinnerYet() {
        assertThat(service.find(ID).winner()).isEmpty();
        assertThat(service.find(ID).finishedAt()).isNull();
    }

    @Given("un joueur blanc nommé {string}")
    public void whitePlayer(String name) {
        whiteName = name;
    }

    @When("il démarre une rencontre avec un joueur noir dont le nom comporte {int} lettres A")
    public void startWithNameLength(int length) {
        assertThat(length).as("longueur de nom décrite par l'exemple").isNotNegative();
        blackName = "A".repeat(length);
        refusal = catchThrowable(() -> match = service.start(whiteName, blackName));
    }

    @Then("le démarrage est {word}")
    public void startingOutcome(String outcome) {
        switch (outcome) {
            case "accepté" -> {
                assertThat(refusal).isNull();
                namesAreStored();
                noWinnerYet();
            }
            case "refusé" -> {
                assertThat(refusal).isExactlyInstanceOf(IllegalArgumentException.class);
                assertThat(repository.findById(ID)).isEmpty();
            }
            default -> throw new AssertionError("Résultat Gherkin inconnu : " + outcome);
        }
    }

    @Given("une rencontre en cours avec {string} aux blancs et {string} aux noirs")
    public void matchInProgress(String white, String black) {
        participants(white, black);
        startMatch();
        game = new Game();
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
    }

    @When("le joueur {word} remporte la partie")
    public void campWins(String camp) {
        Player winner = switch (camp) {
            case "blanc" -> Player.WHITE;
            case "noir" -> Player.BLACK;
            default -> throw new AssertionError("Camp Gherkin inconnu : " + camp);
        };
        recordVictory(winner);
    }

    private void recordVictory(Player winner) {
        game = DameBddFixtures.beforeLastCapture(winner);
        assertThat(game.status()).isEqualTo(GameStatus.IN_PROGRESS);
        game.play(DameBddFixtures.lastCapture(winner));
        service = serviceAt(END);
        match = service.finish(match.id(), game);
    }

    @Then("la rencontre est terminée et son gagnant est {string}")
    public void recordedWinner(String name) {
        Match stored = service.find(ID);
        assertThat(stored).isEqualTo(match);
        assertThat(stored.status()).isEqualTo(game.status()).isNotEqualTo(GameStatus.IN_PROGRESS);
        assertThat(winnerName(stored)).isEqualTo(name);
        assertThat(stored.finishedAt()).isEqualTo(END);
    }

    @Given("une rencontre dont la partie est toujours en cours")
    public void unfinishedMatch() {
        matchInProgress("Cherif", "Amadou");
    }

    @When("on tente d'enregistrer son résultat")
    public void attemptEarlyResult() {
        refusal = catchThrowable(() -> service.finish(match.id(), game));
    }

    @Then("l'enregistrement du résultat est refusé")
    public void earlyResultIsRefused() {
        assertThat(refusal)
                .isExactlyInstanceOf(IllegalArgumentException.class)
                .hasMessage("La partie n'est pas terminée.");
    }

    @Then("la rencontre reste en cours sans gagnant")
    public void matchIsUnchangedAndUnfinished() {
        assertThat(service.find(ID)).isEqualTo(match);
        assertThat(service.find(ID).status()).isEqualTo(GameStatus.IN_PROGRESS);
        noWinnerYet();
    }

    @Given("{string} a remporté cette rencontre")
    public void participantHasWon(String name) {
        recordVictory(playerNamed(name));
    }

    @When("on tente de remplacer son gagnant par {string}")
    public void attemptToReplaceWinner(String name) {
        assertThat(name).isNotEqualTo(winnerName(match));
        Player contender = playerNamed(name);
        Game anotherResult = DameBddFixtures.beforeLastCapture(contender);
        anotherResult.play(DameBddFixtures.lastCapture(contender));
        refusal = catchThrowable(() -> service.finish(match.id(), anotherResult));
    }

    @Then("la modification est refusée")
    public void replacementIsRefused() {
        assertThat(refusal)
                .isExactlyInstanceOf(IllegalStateException.class)
                .hasMessage("Cette rencontre est déjà terminée.");
    }

    @Then("le gagnant reste {string}")
    public void winnerIsUnchanged(String name) {
        assertThat(service.find(ID)).isEqualTo(match);
        assertThat(winnerName(service.find(ID))).isEqualTo(name);
    }

    private Player playerNamed(String name) {
        if (match.whiteName().equals(name)) return Player.WHITE;
        if (match.blackName().equals(name)) return Player.BLACK;
        throw new AssertionError("Le participant Gherkin n'appartient pas à cette rencontre : " + name);
    }

    private static String winnerName(Match stored) {
        return stored.winner()
                .map(camp -> camp == Player.WHITE ? stored.whiteName() : stored.blackName())
                .orElseThrow(() -> new AssertionError("La rencontre n'a pas de gagnant."));
    }
}
