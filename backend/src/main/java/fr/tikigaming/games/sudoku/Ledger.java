package fr.tikigaming.games.sudoku;

import java.math.BigDecimal;
import java.util.List;

/** Registre des pièces créditées. Contrat pur : où et comment c'est stocké relève de l'implémentation. */
public interface Ledger {

    void record(LedgerEntry entry);

    /** Lignes du joueur, de la plus ancienne à la plus récente. */
    List<LedgerEntry> entriesOf(String playerId);

    /** Total des pièces du joueur, 0 s'il n'a aucune ligne. */
    BigDecimal balanceOf(String playerId);
}
