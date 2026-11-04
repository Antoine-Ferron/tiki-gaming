package fr.tikigaming.games.sudoku;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** Fake : un vrai registre qui fonctionne, mais en RAM (liste), sans base ni fichier. */
final class InMemoryLedger implements Ledger {

    private final List<LedgerEntry> entries = new ArrayList<>();

    @Override
    public void record(LedgerEntry entry) {
        entries.add(entry);
    }

    @Override
    public List<LedgerEntry> entriesOf(String playerId) {
        return entries.stream().filter(e -> e.playerId().equals(playerId)).toList();
    }

    @Override
    public BigDecimal balanceOf(String playerId) {
        return entriesOf(playerId).stream().map(LedgerEntry::coins).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    int size() {
        return entries.size();
    }
}
