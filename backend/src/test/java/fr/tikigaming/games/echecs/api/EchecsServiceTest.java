package fr.tikigaming.games.echecs.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Le service traduit le texte reçu par l'API en appels au vrai moteur : aucune doublure (le moteur est pur). */
class EchecsServiceTest {

    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    private final EchecsService service = new EchecsService();

    @Test
    @DisplayName("renvoie les cases accessibles en notation algébrique")
    void renvoieLesCasesAccessiblesEnTexte() {
        // Act + Assert
        assertThat(service.destinations(START, "e2")).containsExactlyInAnyOrder("e3", "e4");
    }

    @Test
    @DisplayName("les cases sont triées : la réponse de l'API est toujours dans le même ordre")
    void lesCasesSontTriees() {
        // Arrange : tour en a1 sur un échiquier presque vide (14 cases)
        String fen = "k7/8/8/8/8/8/8/R6K w - - 0 1";

        // Act + Assert
        assertThat(service.destinations(fen, "a1"))
                .containsExactly("a2", "a3", "a4", "a5", "a6", "a7", "a8", "b1", "c1", "d1", "e1", "f1", "g1");
    }

    @Test
    @DisplayName("jouer un coup renvoie la FEN de la nouvelle position")
    void jouerUnCoupRenvoieLaNouvelleFen() {
        // Act + Assert
        assertThat(service.play(START, "e2", "e4"))
                .isEqualTo("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    }
}
