package fr.tikigaming.games.bang.model;

import io.swagger.v3.oas.annotations.media.Schema;

public record TableSeat(
        @Schema(description = "Code privé à partager avec les autres joueurs", example = "A1B2C3D4E5F6")
        String code,

        @Schema(description = "Place du compte connecté, numérotée de 1 à 4", example = "1")
        int seat,

        @Schema(description = "Nombre de comptes assis à cette table", example = "1")
        int playerCount) {}
