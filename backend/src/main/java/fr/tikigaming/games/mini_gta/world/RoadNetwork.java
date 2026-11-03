package fr.tikigaming.games.mini_gta.world;

import java.util.List;

/**
 * Réseau routier généré : graphe, lignes de la grille et routes de colline.
 *
 * @param hillLines polylignes des routes de colline (aplanissement du terrain, villas)
 * @param hillNodeIds identifiants des nœuds de chaque polyligne, parallèles à ses points
 */
public record RoadNetwork(
        RoadGraph graph,
        List<Double> xs,
        List<Double> zs,
        List<RoadKind> kindX,
        List<RoadKind> kindZ,
        List<Polyline> hillLines,
        List<List<Integer>> hillNodeIds,
        int airfieldEnd) {}
