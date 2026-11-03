package fr.tikigaming.games.mastermind;

import java.util.List;
import java.util.UUID;

public record MastermindGameSnapshot(
        UUID id,
        MastermindStatus status,
        int attemptsUsed,
        int attemptsRemaining,
        List<MastermindGuessResult> history,
        List<MastermindColor> secret,
        int score) {}
