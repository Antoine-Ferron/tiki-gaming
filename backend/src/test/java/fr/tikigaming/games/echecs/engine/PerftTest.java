package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Perft (« performance test ») : test boîte noire de référence des moteurs d'échecs (cours J1_AM). On compte toutes
 * les suites de coups légaux jusqu'à une profondeur donnée et on compare aux valeurs publiées par la communauté
 * (chessprogramming.org, « Perft Results »). Un seul écart révèle un bug : roque, prise en passant, promotion, échec.
 */
class PerftTest {

    private static final List<PieceType> PROMOTIONS =
            List.of(PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT);

    @ParameterizedTest(name = "{3} : profondeur {1} = {2} coups")
    @CsvSource({
        "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 1, 20, position de départ",
        "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 2, 400, position de départ",
        "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3, 8902, position de départ",
        "'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 1, 48, Kiwipete (roques)",
        "'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 2, 2039, Kiwipete (roques)",
        "'8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 3, 2812, position 3 (prise en passant et échecs)",
        "'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 2, 264, position 4 (promotions)",
        "'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 2, 1486, position 5"
    })
    void leNombreDeCoupsLegauxCorrespondAuxValeursDeReference(String fen, int depth, long expected, String name) {
        assertThat(perft(Fen.parse(fen), depth)).as(name).isEqualTo(expected);
    }

    /** Nombre de suites de coups légaux de longueur {@code depth} (une promotion compte pour 4 coups). */
    private static long perft(Position position, int depth) {
        if (depth == 0) {
            return 1;
        }
        long nodes = 0;
        for (Map.Entry<Square, Piece> entry : position.pieces().entrySet()) {
            if (entry.getValue().color() != position.turn()) {
                continue;
            }
            Square from = entry.getKey();
            for (Square to : Game.legalDestinations(position, from)) {
                boolean promotes = entry.getValue().type() == PieceType.PAWN && (to.rank() == 0 || to.rank() == 7);
                for (Optional<PieceType> promotion : promotes
                        ? PROMOTIONS.stream().map(Optional::of).toList()
                        : List.of(Optional.<PieceType>empty())) {
                    nodes += perft(Game.play(position, from, to, promotion), depth - 1);
                }
            }
        }
        return nodes;
    }
}
