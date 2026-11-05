package fr.tikigaming.games.sdv_civilisation;

/**
 * Dummies : objets passés seulement pour remplir un paramètre, que le test n'utilise pas. Ils échouent s'ils sont
 * appelés, ce qui prouve que le scénario n'en dépend pas.
 */
public final class Dummy {

    private Dummy() {}

    public static AuditNotifier audit() {
        return new AuditNotifier() {
            @Override
            public void treasuryThresholdCrossed(TreasuryAlert alert) {
                throw new AssertionError("Dummy : le journal d'audit ne devait pas servir ici");
            }

            @Override
            public void inactivityDetected(InactivityReport report) {
                throw new AssertionError("Dummy : le journal d'audit ne devait pas servir ici");
            }
        };
    }

    public static CurrencyConverter converter() {
        return (resource, quantity) -> {
            throw new AssertionError("Dummy : aucun commerce ne devait avoir lieu ici");
        };
    }
}
