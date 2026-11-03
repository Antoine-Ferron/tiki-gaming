package fr.tikigaming.mastermind;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

public enum MastermindColor {
    RED("red"),
    BLUE("blue"),
    GREEN("green"),
    YELLOW("yellow"),
    ORANGE("orange"),
    PURPLE("purple");

    private final String value;

    MastermindColor(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static MastermindColor fromValue(String value) {
        return Arrays.stream(values())
                .filter(color -> color.value.equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new MastermindValidationException("Couleur inconnue : " + value));
    }
}
