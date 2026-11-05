package fr.tikigaming.games.echecs.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;

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

    @ParameterizedTest(name = "{0} → {1} : « {2} »")
    @CsvSource({"e2, e5, inaccessible", "e7, e5, trait", "e4, e5, vide"})
    @DisplayName("un coup refusé par les règles devient une erreur 422 avec le message du moteur")
    void unCoupRefuseDevientUneErreur422(String from, String to, String reason) {
        // Act + Assert
        assertThatThrownBy(() -> service.play(START, from, to))
                .isInstanceOfSatisfying(
                        EchecsRejectedException.class,
                        e -> assertThat(e.status()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT))
                .hasMessageStartingWith("Coup refusé : ")
                .hasMessageContaining(reason);
    }

    @ParameterizedTest(name = "fen « {0} », de « {1} » vers « {2} »")
    @CsvSource({
        "abc, e2, e4", // FEN mal écrite
        "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', z9, e4", // case de départ hors échiquier
        "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', e2, e44", // case d'arrivée mal écrite
        ", e2, e4", // FEN absente (null)
        "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', , e4" // case absente (null)
    })
    @DisplayName("une entrée mal écrite ou absente devient une erreur 400, distincte d'un coup refusé")
    void uneEntreeMalEcriteDevientUneErreur400(String fen, String from, String to) {
        // Act + Assert : pour jouer comme pour demander les cases
        assertThatThrownBy(() -> service.play(fen, from, to))
                .isInstanceOfSatisfying(
                        EchecsInvalidInputException.class,
                        e -> assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST));
        if (!"e44".equals(to)) {
            assertThatThrownBy(() -> service.destinations(fen, from))
                    .isInstanceOf(EchecsInvalidInputException.class)
                    .hasMessageStartingWith("Entrée invalide : ");
        }
    }
}
