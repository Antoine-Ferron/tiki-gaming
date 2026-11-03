package fr.tikigaming.games.mini_gta.api;

import fr.tikigaming.games.mini_gta.missions.MissionCatalog;
import fr.tikigaming.games.mini_gta.missions.MissionDef;
import fr.tikigaming.games.mini_gta.world.CityData;
import fr.tikigaming.games.mini_gta.world.CityGenerator;
import fr.tikigaming.games.mini_gta.world.Navigation;
import fr.tikigaming.games.mini_gta.world.RoadNode;
import fr.tikigaming.games.mini_gta.world.Vec2;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.LongFunction;
import org.springframework.stereotype.Component;

/**
 * Ville unique du jeu (graine fixe : tous les joueurs ont la même) et ce qui en dépend : catalogue des missions,
 * navigation du GPS et leur forme JSON. Tout est calculé une seule fois, au premier appel, puis partagé.
 */
@Component
public class MiniGtaWorld {
    /** Graine de la ville, la même que celle du prototype d'origine. */
    public static final long SEED = 1337;

    private record Generated(
            Navigation navigation,
            List<MissionDef> missions,
            Map<String, Object> worldJson,
            List<Map<String, Object>> missionsJson) {}

    private final LongFunction<CityData> generator;
    private final long seed;
    private Generated generated;

    public MiniGtaWorld() {
        this(CityGenerator::generate, SEED);
    }

    MiniGtaWorld(LongFunction<CityData> generator, long seed) {
        this.generator = generator;
        this.seed = seed;
    }

    private synchronized Generated generated() {
        if (generated == null) {
            CityData city = generator.apply(seed);
            List<MissionDef> missions = MissionCatalog.story(city.locations());
            generated = new Generated(
                    new Navigation(city.roads().graph()), missions, Json.world(city), Json.missions(missions));
        }
        return generated;
    }

    public Map<String, Object> worldJson() {
        return generated().worldJson();
    }

    public List<Map<String, Object>> missionsJson() {
        return generated().missionsJson();
    }

    public Optional<MissionDef> mission(String id) {
        return generated().missions().stream().filter(m -> m.id().equals(id)).findFirst();
    }

    /**
     * Itinéraire GPS : nœuds de la route la plus rapide, puis la destination exacte. Synchronisé : la recherche
     * de nœud remplit un index interne de {@link Navigation}, qui n'est pas thread-safe.
     */
    public synchronized List<Vec2> route(double fromX, double fromZ, double toX, double toZ) {
        Navigation nav = generated().navigation();
        List<Vec2> out = new ArrayList<>();
        Optional<RoadNode> from = nav.nearestNode(fromX, fromZ);
        Optional<RoadNode> to = nav.nearestNode(toX, toZ);
        if (from.isPresent() && to.isPresent()) {
            for (int id : nav.findPath(from.get().id, to.get().id)) {
                RoadNode n = nav.graph().nodes.get(id);
                out.add(new Vec2(n.x, n.z));
            }
        }
        out.add(new Vec2(toX, toZ));
        return out;
    }
}
