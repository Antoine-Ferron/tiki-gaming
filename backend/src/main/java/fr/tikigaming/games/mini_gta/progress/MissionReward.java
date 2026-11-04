package fr.tikigaming.games.mini_gta.progress;

/** Résultat d'une mission réussie : {@code rewarded} est faux si elle avait déjà été payée. */
public record MissionReward(boolean rewarded, int reward, Progress progress) {}
