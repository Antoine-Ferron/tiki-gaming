package fr.tikigaming.games.sdv_civilisation.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import fr.tikigaming.games.sdv_civilisation.ActionType;
import fr.tikigaming.games.sdv_civilisation.AuditNotifier;
import fr.tikigaming.games.sdv_civilisation.Engine;
import fr.tikigaming.games.sdv_civilisation.FakeClock;
import fr.tikigaming.games.sdv_civilisation.FixedShuffler;
import fr.tikigaming.games.sdv_civilisation.StandardTrade;
import fr.tikigaming.games.sdv_civilisation.Wonders;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Test de contrat back ↔ front : le JSON que le serveur envoie pour une partie type est figé dans des fichiers de
 * référence, que les tests du front utilisent comme réponses de leur faux serveur. Si le format change, ce test
 * échoue : on régénère les fichiers ({@code mvn test -Dcontract.update=true}, puis {@code npm run format} dans
 * frontend/) et les tests du front disent alors ce que le changement casse à l'écran. La comparaison porte sur
 * l'arbre JSON, pas sur la mise en forme.
 */
class GameViewContractTest {

    private static final Path CONTRACT =
            Path.of("..", "frontend", "src", "games", "sdv-civilisation", "test", "contract");
    private static final ObjectMapper JSON =
            JsonMapper.builder().enable(SerializationFeature.INDENT_OUTPUT).build();

    // Fake (horloge figée : 60 s restantes), stub (paquet non mélangé), mocks et spy sans rôle dans le contrat.
    private final StandardTrade trade = new StandardTrade();
    private final SdvCivilisationService service = new SdvCivilisationService(
            new Engine(trade, FixedShuffler.KEEP, mock(AuditNotifier.class)),
            trade,
            new FakeClock(1_000),
            new RecordingScoreRecorder());
    private final InMemoryGameStore store = new InMemoryGameStore();

    private void matchesContract(String name, Object body) throws IOException {
        Path file = CONTRACT.resolve(name + ".json");
        String json = JSON.writeValueAsString(body) + "\n";
        if (Boolean.getBoolean("contract.update") || !Files.exists(file)) {
            Files.createDirectories(CONTRACT);
            Files.writeString(file, json);
        }
        assertThat(JSON.readTree(Files.readString(file)))
                .as("%s ne correspond plus au contrat : relancer avec -Dcontract.update=true", file)
                .isEqualTo(JSON.readTree(json));
    }

    @Test
    void aTypicalGameFromTheChoiceOfTheWonderToTheFinalRanking() throws IOException {
        // Étant donné les merveilles proposées au choix
        matchesContract("wonders", Wonders.ALL);

        // Quand le joueur commence avec la Citadelle d’Orkan
        GameView view = service.start(store, "Citadelle d’Orkan");
        matchesContract("start", view);

        // Et qu'il construit l'"Atelier" (dernière carte de sa main) en achetant le verre à "IA 2"
        view = service.play(store, null, 6, ActionType.BUILD, view.version());
        matchesContract("turn-2", view);

        // Et qu'il défausse jusqu'à la fin de l'âge I (conflits, puis nouvelles cartes de l'âge II)
        while (view.age() == 1) view = service.play(store, null, 0, ActionType.DISCARD, view.version());
        matchesContract("age-2", view);

        // Et jusqu'à la fin de la partie
        while (!view.over()) view = service.play(store, null, 0, ActionType.DISCARD, view.version());
        matchesContract("over", view);

        // Alors chaque étape du contrat a son fichier de référence, relu par les tests du front
        assertThat(view.ranking()).hasSize(3);
    }
}
