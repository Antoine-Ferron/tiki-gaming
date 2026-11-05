package fr.tikigaming.games.dame.bdd;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import fr.tikigaming.games.dame.Board;
import fr.tikigaming.games.dame.Game;
import fr.tikigaming.games.dame.GameRules;
import fr.tikigaming.games.dame.GameStatus;
import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.Piece;
import fr.tikigaming.games.dame.Player;
import fr.tikigaming.games.dame.Position;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.List;
import java.util.Map;

/** Les étapes ne font que préparer une position, appeler Game et vérifier ses effets. */
public class PrisesSteps {

    private Game game;
    private Map<Position, Piece> previousPieces;
    private Player previousPlayer;
    private GameStatus previousStatus;
    private Throwable refusal;

    @Given("les blancs ont le trait et peuvent capturer une pièce noire")
    public void captureIsAvailable() {
        prepare(new Game(
                new Board(Map.of(
                        new Position(6, 1), new Piece(Player.WHITE, false),
                        new Position(5, 2), new Piece(Player.BLACK, false),
                        new Position(0, 9), new Piece(Player.BLACK, false))),
                Player.WHITE));
        assertThat(new GameRules().legalMoves(game.board(), Player.WHITE))
                .contains(DameBddFixtures.lastCapture(Player.WHITE));
    }

    @When("les blancs choisissent un déplacement sans prise")
    public void tryAnOrdinaryMove() {
        refusal = catchThrowable(() -> game.play(new Move(new Position(6, 1), List.of(new Position(5, 0)))));
    }

    @Then("le déplacement est refusé")
    public void ordinaryMoveIsRefused() {
        assertIllegalMove();
    }

    @Given("les blancs ont le trait et peuvent capturer soit deux pièces, soit trois pièces")
    public void competingCaptures() {
        // Deux zones indépendantes : trois prises à gauche, deux prises à droite.
        prepare(new Game(
                new Board(Map.of(
                        new Position(6, 1), new Piece(Player.WHITE, false),
                        new Position(8, 7), new Piece(Player.WHITE, false),
                        new Position(5, 2), new Piece(Player.BLACK, false),
                        new Position(3, 2), new Piece(Player.BLACK, false),
                        new Position(1, 2), new Piece(Player.BLACK, false),
                        new Position(7, 8), new Piece(Player.BLACK, false),
                        new Position(5, 8), new Piece(Player.BLACK, false))),
                Player.WHITE));
    }

    @When("les blancs choisissent la prise de deux pièces")
    public void tryTheShorterCapture() {
        refusal = catchThrowable(() ->
                game.play(new Move(new Position(8, 7), List.of(new Position(6, 9), new Position(4, 7)))));
    }

    @Then("cette prise est refusée")
    public void shorterCaptureIsRefused() {
        assertIllegalMove();
    }

    private void assertIllegalMove() {
        assertThat(refusal)
                .isExactlyInstanceOf(IllegalArgumentException.class)
                .hasMessage("Ce coup n'est pas autorisé.");
    }

    @Then("le plateau et le joueur au trait restent inchangés")
    public void positionIsUnchanged() {
        assertThat(game.board().pieces()).isEqualTo(previousPieces);
        assertThat(game.currentPlayer()).isEqualTo(previousPlayer);
        assertThat(game.status()).isEqualTo(previousStatus);
    }

    @Given("les noirs n'ont plus qu'une pièce et que les blancs ont le trait")
    public void oneBlackPieceRemains() {
        prepare(DameBddFixtures.beforeLastCapture(Player.WHITE));
        assertThat(game.board().pieces().values().stream().filter(piece -> piece.owner() == Player.BLACK))
                .hasSize(1);
    }

    @Given("cette pièce noire peut être capturée par les blancs")
    public void lastCaptureIsAvailable() {
        assertThat(new GameRules().legalMoves(game.board(), Player.WHITE))
                .contains(DameBddFixtures.lastCapture(Player.WHITE));
    }

    @When("les blancs capturent cette dernière pièce")
    public void captureTheLastPiece() {
        game.play(DameBddFixtures.lastCapture(Player.WHITE));
    }

    @Then("les blancs remportent la partie")
    public void whiteWins() {
        assertThat(game.status()).isEqualTo(GameStatus.WHITE_WON);
        assertThat(game.board().pieces().values()).noneMatch(piece -> piece.owner() == Player.BLACK);
    }

    private void prepare(Game initial) {
        game = initial;
        previousPieces = Map.copyOf(game.board().pieces());
        previousPlayer = game.currentPlayer();
        previousStatus = game.status();
        assertThat(previousPlayer).isEqualTo(Player.WHITE);
        assertThat(previousStatus).isEqualTo(GameStatus.IN_PROGRESS);
    }
}
