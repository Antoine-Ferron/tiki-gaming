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
}
