package fr.tikigaming.games.sdv_civilisation;

/** Trésor des joueurs, voir docs/games/sdv-civilisation/regles.md#trésor */
public final class Treasury {

    public static final int ALERT_THRESHOLD = 30;

    private final TreasuryRegistry registry;
    private final AuditNotifier audit;
    private final int threshold;

    public Treasury(TreasuryRegistry registry, AuditNotifier audit) {
        this(registry, audit, ALERT_THRESHOLD);
    }

    public Treasury(TreasuryRegistry registry, AuditNotifier audit, int threshold) {
        this.registry = registry;
        this.audit = audit;
        this.threshold = threshold;
    }

    public int balanceOf(String player) {
        return registry.balanceOf(player);
    }

    public void credit(String player, int amount) {
        requirePositive(amount);
        int before = registry.balanceOf(player);
        int after = before + amount;
        registry.setBalance(player, after);
        if (before < threshold && after >= threshold) {
            audit.treasuryThresholdCrossed(new TreasuryAlert(player, after, threshold));
        }
    }

    public void debit(String player, int amount) {
        requirePositive(amount);
        int balance = registry.balanceOf(player);
        if (amount > balance) {
            throw new IllegalStateException("Pas assez de pièces");
        }
        registry.setBalance(player, balance - amount);
    }

    public void transfer(String from, String to, int amount) {
        debit(from, amount);
        credit(to, amount);
    }

    private static void requirePositive(int amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Le montant doit être un entier positif");
        }
    }
}
