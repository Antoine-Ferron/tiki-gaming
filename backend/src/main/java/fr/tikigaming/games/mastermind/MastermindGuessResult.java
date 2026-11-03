package fr.tikigaming.games.mastermind;

import java.util.List;

public record MastermindGuessResult(List<MastermindColor> guess, MastermindFeedback feedback) {}
