package fr.tikigaming.games.bang.model;

import io.swagger.v3.oas.annotations.media.Schema;

public record GameStarted(
        @Schema(description = "Code de la table privée", example = "A1B2C3D4E5F6")
        String code,

        @Schema(description = "Place du joueur dont c'est le tour, de 1 à 4", example = "3")
        int currentSeat) {}
