package fr.tikigaming.games.sdv_civilisation;

/** Pour une ressource d'un coût : ce que le joueur produit lui-même, achète à chaque voisin, et ce qui manque. */
public record ResourceNeed(Resource resource, int needed, int own, int fromLeft, int fromRight, int missing) {}
