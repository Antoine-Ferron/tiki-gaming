package fr.tikigaming.games.sdv_civilisation;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Ce que coûte une construction : {@code coins} au total, dont {@code toLeft} et {@code toRight} versés aux voisins
 * pour leurs ressources ; gratuite par chaîne ; ou refusée ({@code refusal}).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Payment(
        boolean ok,
        int coins,
        int toLeft,
        int toRight,
        boolean chain,
        @JsonIgnore Refusal refusal) {

    public static final Payment FREE_BY_CHAIN = new Payment(true, 0, 0, 0, true, null);

    public static Payment paid(int coins, int toLeft, int toRight) {
        return new Payment(true, coins, toLeft, toRight, false, null);
    }

    public static Payment refused(Refusal refusal) {
        return new Payment(false, 0, 0, 0, false, refusal);
    }

    @JsonProperty
    public Refusal code() {
        return refusal;
    }

    @JsonProperty
    public String reason() {
        return refusal == null ? null : refusal.reason();
    }
}
