package fr.tikigaming.games.sdv_civilisation;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Une ligne du classement final. */
public record Ranked(String name, @JsonProperty("isBot") boolean bot, int coins, ScoreBreakdown score) {}
