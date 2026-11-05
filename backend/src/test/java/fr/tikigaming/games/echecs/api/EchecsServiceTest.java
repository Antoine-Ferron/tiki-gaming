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
        assertThat(service.play(START, "e2", "e4", null).fen())
                .isEqualTo("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    }

    @ParameterizedTest(name = "{0} → {1} : « {2} »")
    @CsvSource({"e2, e5, inaccessible", "e7, e5, trait", "e4, e5, vide"})
    @DisplayName("un coup refusé par les règles devient une erreur 422 avec le message du moteur")
    void unCoupRefuseDevientUneErreur422(String from, String to, String reason) {
        // Act + Assert
        assertThatThrownBy(() -> service.play(START, from, to, null))
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
        assertThatThrownBy(() -> service.play(fen, from, to, null))
                .isInstanceOfSatisfying(
                        EchecsInvalidInputException.class,
                        e -> assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST));
        if (!"e44".equals(to)) {
            assertThatThrownBy(() -> service.destinations(fen, from))
                    .isInstanceOf(EchecsInvalidInputException.class)
                    .hasMessageStartingWith("Entrée invalide : ");
        }
    }

    @Test
    @DisplayName("les cases renvoyées sont les coups légaux : une pièce clouée n'en a aucune")
    void lesCasesRenvoyeesSontLesCoupsLegaux() {
        assertThat(service.destinations("4k3/8/8/8/4r3/8/4B3/4K3 w - - 0 1", "e2"))
                .isEmpty();
    }

    @Test
    @DisplayName("le coup renvoie aussi l'état de la partie : en cours, puis mat")
    void leCoupRenvoieLEtatDeLaPartie() {
        assertThat(service.play(START, "e2", "e4", null).status()).isEqualTo("ONGOING");
        // mat du lion : la dame noire joue d8-h4
        String beforeMate = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";
        assertThat(service.play(beforeMate, "d8", "h4", null).status()).isEqualTo("CHECKMATE");
    }

    @Test
    @DisplayName("la promotion se choisit par sa lettre FEN (q, r, b, n)")
    void laPromotionSeChoisitParSaLettre() {
        assertThat(service.play("k7/4P3/8/8/8/8/8/7K w - - 0 1", "e7", "e8", "n")
                        .fen())
                .isEqualTo("k3N3/8/8/8/8/8/8/7K b - - 0 1");
    }

    @Test
    @DisplayName("une lettre de promotion inconnue est une entrée invalide (400)")
    void uneLettreDePromotionInconnueDonne400() {
        assertThatThrownBy(() -> service.play("k7/4P3/8/8/8/8/8/7K w - - 0 1", "e7", "e8", "x"))
                .isInstanceOf(EchecsInvalidInputException.class);
    }
}
