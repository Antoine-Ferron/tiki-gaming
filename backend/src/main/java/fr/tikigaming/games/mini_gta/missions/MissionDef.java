package fr.tikigaming.games.mini_gta.missions;

import java.util.List;

/** Définition d'une mission : présentation, récompense, donneur et étapes. */
public record MissionDef(String id, String title, String brief, int reward, Pos giver, List<Step> steps) {
    public MissionDef {
        steps = List.copyOf(steps);
    }
}
