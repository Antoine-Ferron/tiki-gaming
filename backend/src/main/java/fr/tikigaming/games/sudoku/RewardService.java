package fr.tikigaming.games.sudoku;

import java.math.BigDecimal;
import java.util.Map;

/** Convertit le score d'une partie résolue en pièces, l'inscrit au registre et le signale à l'audit. */
public class RewardService {

    static final String SCORE_CURRENCY = "PTS";
    static final String COIN_CURRENCY = "TIKI";
    static final String REWARD_GRANTED = "REWARD_GRANTED";
    static final String CRITICAL_THRESHOLD_CROSSED = "CRITICAL_THRESHOLD_CROSSED";

    /** Solde (en pièces) à partir duquel l'audit est prévenu, une seule fois, au franchissement. */
    static final BigDecimal CRITICAL_BALANCE = new BigDecimal("100");

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
        BigDecimal balanceBefore = ledger.balanceOf(playerId);
        ledger.record(new LedgerEntry(playerId, now, score, coins));
        audit.notify(new AuditEvent(
                REWARD_GRANTED,
                now,
                Map.of("player", playerId, "score", String.valueOf(score), "coins", coins.toPlainString())));
        BigDecimal balanceAfter = balanceBefore.add(coins);
        if (crossesCriticalBalance(balanceBefore, balanceAfter)) {
            audit.notify(new AuditEvent(
                    CRITICAL_THRESHOLD_CROSSED,
                    now,
                    Map.of(
                            "player", playerId,
                            "balance", balanceAfter.toPlainString(),
                            "threshold", CRITICAL_BALANCE.toPlainString())));
        }
        return coins;
    }

    /** Franchissement : on était sous le seuil, on est maintenant dessus (ou pile dessus). */
    private static boolean crossesCriticalBalance(BigDecimal before, BigDecimal after) {
        return before.compareTo(CRITICAL_BALANCE) < 0 && after.compareTo(CRITICAL_BALANCE) >= 0;
    }
}
