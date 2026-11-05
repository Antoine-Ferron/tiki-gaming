package fr.tikigaming.games.dame.api;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import fr.tikigaming.games.dame.Move;
import fr.tikigaming.games.dame.Position;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.annotation.JsonDeserialize;

public final class DameRequests {

    private DameRequests() {}

    @Schema(name = "DameStartRequest", additionalProperties = Schema.AdditionalPropertiesValue.FALSE)
    public record Start(
            @NotBlank(message = "Indique le nom du joueur blanc.")
            @JsonDeserialize(using = DameJsonTypes.StringValue.class)
            @Schema(example = "Cherif", description = "De 1 à 50 caractères après retrait des espaces extérieurs")
            String whiteName,

            @NotBlank(message = "Indique le nom du joueur noir.")
            @JsonDeserialize(using = DameJsonTypes.StringValue.class)
            @Schema(example = "Amadou", description = "De 1 à 50 caractères après retrait des espaces extérieurs")
            String blackName) {

        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode value) {
            throw unexpectedField();
        }
    }

    @Schema(name = "DameCoordinate", additionalProperties = Schema.AdditionalPropertiesValue.FALSE)
    public record Coordinate(
            @NotNull(message = "Indique la ligne.")
            @Min(value = 0, message = "La ligne doit être comprise entre 0 et 9.")
            @Max(value = 9, message = "La ligne doit être comprise entre 0 et 9.")
            @JsonDeserialize(using = DameJsonTypes.IntegerValue.class)
            Integer row,

            @NotNull(message = "Indique la colonne.")
            @Min(value = 0, message = "La colonne doit être comprise entre 0 et 9.")
            @Max(value = 9, message = "La colonne doit être comprise entre 0 et 9.")
            @JsonDeserialize(using = DameJsonTypes.IntegerValue.class)
            Integer column) {

        Position position() {
            return new Position(row, column);
        }

        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode value) {
            throw unexpectedField();
        }
    }

    @Schema(name = "DameMoveRequest", additionalProperties = Schema.AdditionalPropertiesValue.FALSE)
    public record Play(
            @NotNull(message = "Indique la version de la partie.")
            @Min(value = 0, message = "La version ne peut pas être négative.")
            @JsonDeserialize(using = DameJsonTypes.IntegerValue.class)
            Integer version,

            @NotNull(message = "Choisis une pièce.") @Valid Coordinate from,

            @NotEmpty(message = "Choisis une case d'arrivée.")
            @Size(max = 20, message = "Un coup ne peut pas dépasser 20 arrivées.")
            List<@NotNull @Valid Coordinate> landings) {

        Move move() {
            return new Move(
                    from.position(), landings.stream().map(Coordinate::position).toList());
        }

        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode value) {
            throw unexpectedField();
        }
    }

    private static IllegalArgumentException unexpectedField() {
        return new IllegalArgumentException("Cette requête contient un champ inattendu.");
    }
}
