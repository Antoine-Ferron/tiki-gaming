package fr.tikigaming.mastermind;

import java.util.List;

public record MastermindGuessResult(List<MastermindColor> guess, MastermindFeedback feedback) {}
