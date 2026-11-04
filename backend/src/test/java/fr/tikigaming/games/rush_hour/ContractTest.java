package fr.tikigaming.games.rush_hour;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Contrat partagé avec le jeu (shared/games/rush-hour/contrat.json) : le front rejoue les mêmes exemples
 * (contract.test.ts). Si le jeu et le serveur divergent, l'une des deux suites échoue.
 */
class ContractTest {

    private static final JsonNode CONTRACT = new ObjectMapper()
            .readTree(Path.of("../shared/games/rush-hour/contrat.json").toFile());

    private static Stream<JsonNode> each(String section) {
        return StreamSupport.stream(CONTRACT.get(section).spliterator(), false);
    }

    private static List<String> map(JsonNode node) {
        List<String> rows = new ArrayList<>();
        node.get("map").forEach(row -> rows.add(row.asString()));
        return rows;
    }

    /** Résultat attendu, au même format que le contrat : « coups:N », « score:N » ou « refus:message ». */
    private static String expected(JsonNode node) {
        JsonNode result = node.get("resultat");
        String key = result.propertyNames().iterator().next();
        return key + ":" + result.get(key).asString();
    }

    static Stream<Arguments> levels() {
        return each("niveaux")
                .map(n -> Arguments.of(n.get("numero").asInt(), n.get("minimum").asInt(), map(n)));
    }

    @ParameterizedTest(name = "niveau {0} : même map et minimum de {1} coups")
    @MethodSource("levels")
    void serverHasTheContractLevels(int number, int minimum, List<String> map) {
        // Act
        List<String> serverMap = Levels.map(number).orElseThrow();

        // Assert
        assertThat(serverMap).isEqualTo(map);
        assertThat(Solver.minimumMoves(Board.parse(serverMap))).hasValue(minimum);
    }

    static Stream<Arguments> games() {
        return each("parties").map(Arguments::of);
    }

    @ParameterizedTest(name = "partie {index}")
    @MethodSource("games")
    void serverReplaysTheContractGames(JsonNode game) {
        // Arrange
        List<Move> moves = new ArrayList<>();
        game.get("coups")
                .forEach(m -> moves.add(new Move(
                        m.get("vehicule").asString().charAt(0), m.get("delta").asInt())));

        // Act
        String result;
        try {
            result = "coups:" + SolutionVerifier.replay(map(game), moves);
        } catch (IllegalArgumentException e) {
            result = "refus:" + e.getMessage();
        }

        // Assert
        assertThat(result).isEqualTo(expected(game));
    }

    static Stream<Arguments> scale() {
        return each("bareme")
                .map(n -> Arguments.of(
                        n.get("coups").asInt(),
                        n.get("minimum").asInt(),
                        n.get("indices").asInt(),
                        n));
    }

    @ParameterizedTest(name = "{0} coups, minimum {1}, {2} indice(s)")
    @MethodSource("scale")
    void serverAppliesTheContractScale(int moves, int minimum, int hints, JsonNode row) {
        // Act
        String result;
        try {
            result = "score:" + Scoring.levelScore(moves, minimum, hints);
        } catch (IllegalArgumentException e) {
            result = "refus:" + e.getMessage();
        }

        // Assert
        assertThat(result).isEqualTo(expected(row));
    }
}
