package fr.tikigaming.games.mini_gta.features;

import static org.assertj.core.api.Assertions.assertThat;

import fr.tikigaming.games.mini_gta.api.MiniGtaWorld;
import fr.tikigaming.games.mini_gta.core.MathUtil;
import fr.tikigaming.games.mini_gta.world.Block;
import fr.tikigaming.games.mini_gta.world.Building;
import fr.tikigaming.games.mini_gta.world.CityData;
import fr.tikigaming.games.mini_gta.world.CityGenerator;
import fr.tikigaming.games.mini_gta.world.FacadeStyle;
import fr.tikigaming.games.mini_gta.world.Ramp;
import fr.tikigaming.games.mini_gta.world.RampKind;
import fr.tikigaming.games.mini_gta.world.RoadEdge;
import fr.tikigaming.games.mini_gta.world.RoadGraph;
import fr.tikigaming.games.mini_gta.world.RoadNode;
import fr.tikigaming.games.mini_gta.world.WorldConstants;
import io.cucumber.java.fr.Alors;
import io.cucumber.java.fr.Et;
import io.cucumber.java.fr.Etantdonné;
import io.cucumber.java.fr.Quand;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

/** Étapes de la ville : graine fixe et GPS par l'API, tremplins et bâtiments ouverts sur la ville générée. */
public class CitySteps {

    /** Ville du jeu, générée une seule fois pour toute la suite (quelques centaines de millisecondes). */
    private static CityData city;

    private static final Map<String, RampKind> MATERIALS =
            Map.of("terre", RampKind.DIRT, "béton", RampKind.CONCRETE, "planches", RampKind.PLANKS);

    private JsonNode first;
    private JsonNode second;
    private String from;
    private JsonNode route;
    private List<Ramp> ramps;
    private List<Building> ordinary;
    private List<Building> open;

    @Etantdonné("deux joueurs")
    public void deuxJoueurs() {
        first = null;
        second = null;
    }

    @Quand("chacun charge la ville")
    public void chacunChargeLaVille() {
        first = MiniGtaApi.get("/world");
        second = MiniGtaApi.get("/world");
    }

    @Alors("ils reçoivent la même ville")
    public void ilsRecoiventLaMemeVille() {
        assertThat(second).isEqualTo(first);
    }

    @Et("cette ville vient de la graine {int}")
    public void cetteVilleVientDeLaGraine(int seed) {
        assertThat(first.get("seed").asLong()).isEqualTo(seed);
    }

    @Alors("la ville compte {int} donneurs de missions")
    public void laVilleCompteDesDonneursDeMissions(int count) {
        assertThat(first.get("locations").get("missionGivers").size()).isEqualTo(count);
    }

    @Etantdonné("un joueur au point \\({int}, {int})")
    public void unJoueurAuPoint(int x, int z) {
        from = x + "&fromZ=" + z;
    }

    @Quand("^il demande au GPS d'aller en \\((\\S+), (\\S+)\\)$")
    public void ilDemandeAuGps(String toX, String toZ) {
        route = MiniGtaApi.get("/route?fromX=" + from + "&toX=" + toX + "&toZ=" + toZ);
    }

    @Alors("l'itinéraire passe par plusieurs points")
    public void lItinerairePasseParPlusieursPoints() {
        assertThat(route.size()).isGreaterThan(2);
    }

    @Et("l'itinéraire se termine en \\({int}, {int})")
    public void lItineraireSeTermineEn(int x, int z) {
        JsonNode last = route.get(route.size() - 1);
        assertThat(last.get("x").asDouble()).isEqualTo(x);
        assertThat(last.get("z").asDouble()).isEqualTo(z);
    }

    @Alors("le GPS refuse la destination")
    public void leGpsRefuseLaDestination() {
        MiniGtaApi.assertRefused(400);
    }

    @Etantdonné("la ville du jeu")
    public void laVilleDuJeu() {
        if (city == null) city = CityGenerator.generate(MiniGtaWorld.SEED);
    }

    @Quand("on recense ses tremplins")
    public void onRecenseSesTremplins() {
        ramps = city.ramps();
    }

    @Quand("on recense ses bâtiments ouverts")
    public void onRecenseSesBatimentsOuverts() {
        ordinary = city.buildings().stream().filter(b -> b.special == null).toList();
        open = ordinary.stream().filter(b -> b.doorSide != null).toList();
    }

    @Alors("au moins un tremplin est en {word}")
    public void auMoinsUnTremplinEstEn(String material) {
        assertThat(MATERIALS).containsKey(material);
        assertThat(ramps).anyMatch(r -> r.kind() == MATERIALS.get(material));
    }

    private static double reach(Ramp r) {
        return Math.hypot(r.length(), r.width()) / 2;
    }

    @Alors("aucun tremplin n'empiète sur une route empruntée par le trafic")
    public void aucunTremplinSurUneRoute() {
        RoadGraph g = city.roads().graph();
        for (Ramp r : ramps) {
            for (RoadEdge e : g.edges) {
                RoadNode a = g.nodes.get(e.a());
                RoadNode b = g.nodes.get(e.b());
                double d =
                        MathUtil.pointSegment(r.x(), r.z(), a.x, a.z, b.x, b.z).d();
                assertThat(d).as("tremplin %s sur la route %s", r, e.id()).isGreaterThan(e.width() / 2 + reach(r));
            }
        }
    }

    @Et("aucun tremplin ne chevauche un bâtiment")
    public void aucunTremplinSurUnBatiment() {
        for (Ramp r : ramps) {
            for (Building b : city.buildings()) {
                double margin = (b.rot == 0 ? 0 : Math.max(b.hw, b.hd)) + reach(r);
                boolean overlaps = Math.abs(b.x - r.x()) < b.hw + margin && Math.abs(b.z - r.z()) < b.hd + margin;
                assertThat(overlaps)
                        .as("tremplin %s sur le bâtiment %d", r, b.id)
                        .isFalse();
            }
        }
    }

    @Et("aucun tremplin n'est dans l'eau")
    public void aucunTremplinDansLEau() {
        assertThat(ramps).allMatch(r -> r.x() - WorldConstants.shoreX(r.z()) > 10);
    }

    @Alors("entre {int} % et {int} % des bâtiments ordinaires sont ouverts")
    public void unBatimentSurCinqEstOuvert(int min, int max) {
        double share = 100.0 * open.size() / ordinary.size();
        assertThat(share).isBetween((double) min, (double) max);
    }

    @Et("des maisons comme des immeubles sont ouverts")
    public void desMaisonsCommeDesImmeubles() {
        assertThat(open).anyMatch(b -> b.style == FacadeStyle.HOUSE);
        assertThat(open).anyMatch(b -> b.style != FacadeStyle.HOUSE);
    }

    @Alors("chacun a sa porte du côté de la rue")
    public void chaqueBatimentOuvertAUnePorteCoteRue() {
        for (Building b : open) {
            Block block = city.blocks().stream()
                    .filter(bl -> bl.containsStrict(b.x, b.z))
                    .findFirst()
                    .orElseThrow();
            // Distance de chaque façade (nord, est, sud, ouest) au bord de l'îlot, donc à la rue.
            double[] gap = {
                b.z - b.hd - block.z0(), block.x1() - (b.x + b.hw), block.z1() - (b.z + b.hd), b.x - b.hw - block.x0()
            };
            double street = Arrays.stream(gap).min().orElseThrow();
            assertThat(gap[b.doorSide]).as("porte côté cour : %d", b.id).isLessThanOrEqualTo(street + 1e-9);
        }
    }

    @Et("le rez-de-chaussée de chacun fait au moins {double} m de haut, sans dépasser le bâtiment")
    public void leRezDeChausseeEstAccessible(double minHeight) {
        for (Building b : open) {
            assertThat(b.floorHeight).as("rez-de-chaussée du bâtiment %d", b.id).isBetween(minHeight, b.h);
        }
    }
}
