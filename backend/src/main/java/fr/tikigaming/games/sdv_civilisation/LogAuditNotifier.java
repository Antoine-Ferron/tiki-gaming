package fr.tikigaming.games.sdv_civilisation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Implémentation de production : signalement dans les logs du serveur, sans appel réseau. */
public final class LogAuditNotifier implements AuditNotifier {

    private static final Logger log = LoggerFactory.getLogger(LogAuditNotifier.class);

    @Override
    public void treasuryThresholdCrossed(TreasuryAlert alert) {
        log.warn(
                "Trésor au-dessus du seuil critique : joueur={}, solde={}, seuil={}",
                alert.player(),
                alert.balance(),
                alert.threshold());
    }

    @Override
    public void inactivityDetected(InactivityReport report) {
        log.warn("Tour expiré sans carte jouée : joueur={}, heure limite={}", report.player(), report.deadline());
    }
}
