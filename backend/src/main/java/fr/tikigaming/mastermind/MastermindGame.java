package fr.tikigaming.mastermind;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

final class MastermindGame {
    static final int CODE_LENGTH = 4;
    static final int MAX_ATTEMPTS = 10;

    private final UUID id;
    private List<MastermindColor> secret;
    private final List<MastermindGuessResult> history = new ArrayList<>();
    private MastermindStatus status = MastermindStatus.IN_PROGRESS;

    MastermindGame(UUID id, List<MastermindColor> secret) {
        this.id = id;
        this.secret = List.copyOf(secret);
    }

    synchronized MastermindGameSnapshot snapshot() {
        return new MastermindGameSnapshot(
                id,
                status,
                history.size(),
                MAX_ATTEMPTS - history.size(),
                List.copyOf(history),
                status == MastermindStatus.IN_PROGRESS ? null : secret,
                status == MastermindStatus.WON ? MAX_ATTEMPTS - history.size() + 1 : 0);
    }

    synchronized MastermindGameSnapshot guess(List<MastermindColor> colors) {
        validateGuess(colors);
        if (status != MastermindStatus.IN_PROGRESS) {
            throw new MastermindFinishedException("La partie est déjà terminée.");
        }

        MastermindFeedback feedback = evaluate(secret, colors);
        history.add(new MastermindGuessResult(List.copyOf(colors), feedback));
        if (feedback.exact() == CODE_LENGTH) {
            status = MastermindStatus.WON;
        } else if (history.size() == MAX_ATTEMPTS) {
            status = MastermindStatus.LOST;
        }
        return snapshot();
    }

    synchronized void restart(List<MastermindColor> newSecret) {
        secret = List.copyOf(newSecret);
        history.clear();
        status = MastermindStatus.IN_PROGRESS;
    }

    private static void validateGuess(List<MastermindColor> colors) {
        if (colors == null || colors.size() != CODE_LENGTH || colors.stream().anyMatch(color -> color == null)) {
            throw new MastermindValidationException("Une proposition doit contenir exactement 4 couleurs valides.");
        }
    }

    static MastermindFeedback evaluate(List<MastermindColor> secret, List<MastermindColor> guess) {
        int exact = 0;
        int[] secretCounts = new int[MastermindColor.values().length];
        int[] guessCounts = new int[MastermindColor.values().length];
        for (int i = 0; i < CODE_LENGTH; i++) {
            if (secret.get(i) == guess.get(i)) exact++;
            else {
                secretCounts[secret.get(i).ordinal()]++;
                guessCounts[guess.get(i).ordinal()]++;
            }
        }
        int misplaced = 0;
        for (int i = 0; i < secretCounts.length; i++) misplaced += Math.min(secretCounts[i], guessCounts[i]);
        return new MastermindFeedback(exact, misplaced);
    }
}
