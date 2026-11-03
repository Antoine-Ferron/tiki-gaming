package fr.tikigaming.games.sdv_civilisation;

/** Contrat sans I/O : journal d'audit anti-triche. */
public interface AuditNotifier {

    void treasuryThresholdCrossed(TreasuryAlert alert);
}
