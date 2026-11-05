package fr.tikigaming.games.sdv_civilisation;

/** Score final d'un joueur, catégorie par catégorie, voir docs/games/sdv-civilisation/regles.md#score */
public record ScoreBreakdown(int military, int treasury, int wonder, int civil, int science, int guilds, int total) {}
