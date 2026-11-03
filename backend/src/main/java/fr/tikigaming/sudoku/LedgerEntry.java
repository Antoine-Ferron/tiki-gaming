package fr.tikigaming.sudoku;

import java.math.BigDecimal;
import java.time.Instant;

/** Ligne du registre : pièces créditées à un joueur pour un score donné. */
public record LedgerEntry(String playerId, Instant at, int score, BigDecimal coins) {}
