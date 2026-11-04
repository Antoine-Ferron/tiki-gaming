package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.tikigaming.config.ApiException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** Test unitaire pur : le service est appelé comme un objet Java, sans contexte Spring. */
class LevelResultServiceTest {

    /** Solution la plus courte du niveau 1 (3 coups). */
    private static final List<Move> LEVEL_1_SOLUTION = List.of(new Move('A', 3), new Move('H', -1), new Move('X', 3));

    private final LevelResultService service = new LevelResultService();

    @Test
    void scoresAWinningGameOnTheServer() {
        // Act
        LevelResult result = service.verify(1, LEVEL_1_SOLUTION, 0);

        // Assert
        assertThat(result).isEqualTo(new LevelResult(1000, 3, 3));
    }

    @Test
    void eachHintCostsPointsOnTheServerToo() {
        // Act
        LevelResult result = service.verify(1, LEVEL_1_SOLUTION, 1);

        // Assert
        assertThat(result.score()).isEqualTo(800);
    }

    @Test
    void unknownLevelIsNotFound() {
        // Act + Assert
        assertThatThrownBy(() -> service.verify(21, LEVEL_1_SOLUTION, 0))
                .isInstanceOf(ApiException.class)
                .hasMessage("Niveau inconnu : 21")
                .extracting(e -> ((ApiException) e).status())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void illegalMovesAreRefused() {
        // Act + Assert : la voiture rouge avance sans que la sortie soit libre
        assertThatThrownBy(() -> service.verify(1, List.of(new Move('X', 3)), 0))
                .isInstanceOf(ApiException.class)
                .hasMessage("Partie refusée : Déplacement impossible : X de 3")
                .extracting(e -> ((ApiException) e).status())
                .isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
    }

    @Test
    void negativeHintsAreRefused() {
        // Act + Assert
        assertThatThrownBy(() -> service.verify(1, LEVEL_1_SOLUTION, -1))
                .isInstanceOf(ApiException.class)
                .hasMessage("Partie refusée : Nombre d’indices impossible : -1")
                .extracting(e -> ((ApiException) e).status())
                .isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
    }
}
