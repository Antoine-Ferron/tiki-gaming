package fr.tikigaming.sudoku;

/**
 * Point de sortie des événements d'audit. Le code métier ne sait pas où ils vont (journal, base, file de
 * messages) : c'est le rôle de l'implémentation, jamais du domaine.
 */
public interface AuditNotifier {

    void notify(AuditEvent event);
}
