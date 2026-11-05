package fr.tikigaming.games.echecs.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Test de propriétés (cours J3_AM, même idée que fast-check côté front) : des parties jouées au hasard, sans résultat
 * attendu écrit à la main. À chaque coup tiré parmi les cases accessibles du camp au trait, on vérifie des propriétés
 * qui doivent toujours tenir. Graine fixe : un échec se rejoue à l'identique (la partie fautive est affichée).
 */
class GamePropertyTest {

    private static final long SEED = 20261104L;
    private static final int GAMES = 300;
    private static final int MAX_PLIES = 80;
    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    @Test
    @DisplayName("sur 300 parties au hasard, tout coup proposé par le moteur se joue et garde une position cohérente")
    void toutCoupProposeSeJoueEtGardeUnePositionCoherente() {
        Random random = new Random(SEED);
        for (int game = 0; game < GAMES; game++) {
            Position position = Fen.parse(START);
            List<String> moves = new ArrayList<>();
            for (int ply = 0; ply < MAX_PLIES; ply++) {
                List<Square[]> candidates = candidateMoves(position);
                if (candidates.isEmpty()) {
                    break;
                }
                Square[] move = candidates.get(random.nextInt(candidates.size()));
                moves.add(move[0] + "-" + move[1]);
                if (isKnownLimitation(position, move)) {
                    break; // limite connue du moteur (voir isKnownLimitation) : on arrête cette partie
                }
                Position next;
                try {
                    next = Game.play(position, move[0], move[1]);
                } catch (RuntimeException e) {
                    fail(
                            "Partie " + game + ", coup refusé alors que proposé : " + moves + " depuis "
                                    + Fen.toFen(position),
                            e);
                    return;
                }
                // Propriété 1 : le trait alterne
                assertThat(next.turn()).as("trait après %s", moves).isNotEqualTo(position.turn());
                // Propriété 2 : jamais de pièce créée (au plus une prise)
                assertThat(next.pieces().size())
                        .isBetween(
                                position.pieces().size() - 1, position.pieces().size());
                // Propriété 3 : la FEN produite est canonique et se relit à l'identique
                String fen = Fen.toFen(next);
                assertThat(Fen.toFen(Fen.parse(fen))).as("FEN après %s", moves).isEqualTo(fen);
                position = next;
            }
        }
    }

    /**
     * Limites connues, trouvées par ce test et tracées comme anomalies (docs/etapes/22) : elles seront levées par les
     * phases suivantes, et cette méthode devra alors rétrécir.
     *
     * <ul>
     *   <li>ANO-ECH-01 (prise du roi) : <b>levée</b> par les coups légaux (règle L2) : un coup légal ne prend jamais
     *       le roi.
     *   <li>ANO-ECH-02 : un pion qui atteint la dernière rangée. La promotion n'est pas encore gérée (phase 4).
     * </ul>
     */
    private static boolean isKnownLimitation(Position position, Square[] move) {
        boolean promotes = position.pieceAt(move[0])
                        .map(piece -> piece.type() == PieceType.PAWN)
                        .orElse(false)
                && (move[1].rank() == 0 || move[1].rank() == 7);
        return promotes;
    }

    /** Tous les coups légaux (départ, arrivée) que le moteur propose au camp qui a le trait. */
    private static List<Square[]> candidateMoves(Position position) {
        List<Square[]> moves = new ArrayList<>();
        for (Map.Entry<Square, Piece> entry : position.pieces().entrySet()) {
            if (entry.getValue().color() == position.turn()) {
                for (Square to : Game.legalDestinations(position, entry.getKey())) {
                    moves.add(new Square[] {entry.getKey(), to});
                }
            }
        }
        moves.sort((a, b) -> (a[0] + "" + a[1]).compareTo(b[0] + "" + b[1])); // ordre stable : graine reproductible
        return moves;
    }
}
