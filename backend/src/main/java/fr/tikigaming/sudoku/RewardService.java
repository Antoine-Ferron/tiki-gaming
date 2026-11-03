package fr.tikigaming.sudoku;

import java.math.BigDecimal;
import java.util.Map;

/** Convertit le score d'une partie résolue en pièces, l'inscrit au registre et le signale à l'audit. */
public class RewardService {

    static final String SCORE_CURRENCY = "PTS";
    static final String COIN_CURRENCY = "TIKI";

    private final Clock clock;
    private final CurrencyConverter converter;
    private final Ledger ledger;
    private final AuditNotifier audit;

    public RewardService(Clock clock, CurrencyConverter converter, Ledger ledger, AuditNotifier audit) {
        this.clock = clock;
        this.converter = converter;
        this.ledger = ledger;
        this.audit = audit;
    }

    /**
     * @return les pièces créditées
     * @throws IllegalArgumentException si le joueur est vide ou le score négatif ; dans ce cas, et si la
     *     conversion échoue, ni le registre ni l'audit ne sont modifiés
     */
    public BigDecimal reward(String playerId, int score) {
        if (playerId == null || playerId.isBlank()) {
            throw new IllegalArgumentException("Joueur manquant");
        }
        if (score < 0) {
            throw new IllegalArgumentException("Le score doit être positif");
        }
        BigDecimal coins = converter.convert(BigDecimal.valueOf(score), SCORE_CURRENCY, COIN_CURRENCY);
        var now = clock.now();
        ledger.record(new LedgerEntry(playerId, now, score, coins));
        audit.notify(new AuditEvent(
                "REWARD_GRANTED",
                now,
                Map.of("player", playerId, "score", String.valueOf(score), "coins", coins.toPlainString())));
        return coins;
    }
}
