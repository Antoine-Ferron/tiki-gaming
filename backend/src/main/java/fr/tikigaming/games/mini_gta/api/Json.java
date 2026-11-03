package fr.tikigaming.games.mini_gta.api;

import fr.tikigaming.games.mini_gta.missions.MissionDef;
import fr.tikigaming.games.mini_gta.missions.Pos;
import fr.tikigaming.games.mini_gta.missions.Step;
import fr.tikigaming.games.mini_gta.weapons.WeaponDef;
import fr.tikigaming.games.mini_gta.weapons.WeaponId;
import fr.tikigaming.games.mini_gta.world.Block;
import fr.tikigaming.games.mini_gta.world.Building;
import fr.tikigaming.games.mini_gta.world.CityData;
import fr.tikigaming.games.mini_gta.world.Container;
import fr.tikigaming.games.mini_gta.world.Location;
import fr.tikigaming.games.mini_gta.world.Locations;
import fr.tikigaming.games.mini_gta.world.ParkingSpot;
import fr.tikigaming.games.mini_gta.world.Polyline;
import fr.tikigaming.games.mini_gta.world.Prop;
import fr.tikigaming.games.mini_gta.world.Rect;
import fr.tikigaming.games.mini_gta.world.RoadEdge;
import fr.tikigaming.games.mini_gta.world.RoadNetwork;
import fr.tikigaming.games.mini_gta.world.RoadNode;
import fr.tikigaming.games.mini_gta.world.SidewalkNode;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Contrat JSON avec le front. Les objets ont exactement la forme des types TypeScript du client
 * ({@code CityData}, {@code Step}, {@code WeaponDef}…) : noms d'énumérations en camelCase, champs
 * optionnels omis quand ils sont absents.
 */
public final class Json {
    private Json() {}

    // --- Utilitaires ---------------------------------------------------------------------------

    /** {@code TRAFFIC_LIGHT} → {@code trafficLight}. */
    public static String camel(String constant) {
        StringBuilder sb = new StringBuilder();
        boolean upper = false;
        for (char ch : constant.toLowerCase().toCharArray()) {
            if (ch == '_') {
                upper = true;
            } else {
                sb.append(upper ? Character.toUpperCase(ch) : ch);
                upper = false;
            }
        }
        return sb.toString();
    }

    static String camel(Enum<?> e) {
        return camel(e.name());
    }

    /** Map ordonnée construite par paires clé/valeur ; les valeurs nulles sont omises. */
    private static Map<String, Object> obj(Object... kv) {
        if (kv.length % 2 != 0) throw new IllegalArgumentException("obj() attend des paires clé/valeur");
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            if (kv[i + 1] != null) m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    // --- Monde ---------------------------------------------------------------------------------

    public static Map<String, Object> world(CityData c) {
        return obj(
                "seed", c.seed(),
                "terrain",
                        obj(
                                "n",
                                c.terrain().cells(),
                                "heights",
                                base64(c.terrain().heights())),
                "roads", roads(c.roads()),
                "blocks", c.blocks().stream().map(Json::block).toList(),
                "buildings", c.buildings().stream().map(Json::building).toList(),
                "props", c.props().stream().map(Json::prop).toList(),
                "containers", c.containers().stream().map(Json::container).toList(),
                "cranes", c.cranes().stream().map(Json::location).toList(),
                "parking", c.parking().stream().map(Json::parking).toList(),
                "sidewalk", c.sidewalk().stream().map(Json::sidewalk).toList(),
                "locations", locations(c.locations()));
    }

    static String base64(float[] values) {
        ByteBuffer buf = ByteBuffer.allocate(values.length * 4).order(ByteOrder.LITTLE_ENDIAN);
        buf.asFloatBuffer().put(values);
        return Base64.getEncoder().encodeToString(buf.array());
    }

    private static Map<String, Object> roads(RoadNetwork r) {
        List<Object> nodes = new ArrayList<>();
        for (RoadNode n : r.graph().nodes) {
            nodes.add(obj(
                    "id",
                    n.id,
                    "x",
                    n.x,
                    "z",
                    n.z,
                    "y",
                    n.y,
                    "edges",
                    n.edges,
                    "light",
                    n.light,
                    "lightOffset",
                    n.lightOffset,
                    "radius",
                    n.radius,
                    "square",
                    n.square));
        }
        List<Object> edges = new ArrayList<>();
        for (RoadEdge e : r.graph().edges) {
            edges.add(obj(
                    "id",
                    e.id(),
                    "a",
                    e.a(),
                    "b",
                    e.b(),
                    "kind",
                    camel(e.kind()),
                    "lanes",
                    e.lanes(),
                    "width",
                    e.width(),
                    "speed",
                    e.speed(),
                    "length",
                    e.length()));
        }
        return obj(
                "nodes", nodes,
                "edges", edges,
                "xs", r.xs(),
                "zs", r.zs(),
                "kindX", r.kindX().stream().map(Json::camel).toList(),
                "kindZ", r.kindZ().stream().map(Json::camel).toList(),
                "hillLines", r.hillLines().stream().map(Json::polyline).toList(),
                "hillNodeIds", r.hillNodeIds(),
                "airfieldEnd", r.airfieldEnd());
    }

    private static Map<String, Object> polyline(Polyline p) {
        return obj(
                "points",
                p.points().stream().map(pt -> obj("x", pt.x(), "z", pt.z())).toList(),
                "width",
                p.width());
    }

    private static Map<String, Object> rect(Rect r) {
        return r == null ? null : obj("x0", r.x0(), "x1", r.x1(), "z0", r.z0(), "z1", r.z1());
    }

    private static Map<String, Object> block(Block b) {
        return obj(
                "id",
                b.id(),
                "x0",
                b.x0(),
                "x1",
                b.x1(),
                "z0",
                b.z0(),
                "z1",
                b.z1(),
                "district",
                camel(b.district()),
                "park",
                b.park(),
                "gi",
                b.gi(),
                "gj",
                b.gj());
    }

    private static Map<String, Object> building(Building b) {
        return obj(
                "id",
                b.id,
                "x",
                b.x,
                "z",
                b.z,
                "hw",
                b.hw,
                "hd",
                b.hd,
                "y0",
                b.y0,
                "h",
                b.h,
                "rot",
                b.rot,
                "style",
                b.style.code(),
                "color",
                b.color,
                "roof",
                camel(b.roof),
                "tier",
                b.tier == null ? null : obj("hw", b.tier.hw(), "hd", b.tier.hd(), "h", b.tier.h()),
                "special",
                b.special == null ? null : camel(b.special),
                "hollow",
                b.doorSide == null ? null : obj("doorSide", b.doorSide),
                "lot",
                rect(b.lot),
                "chunk",
                b.chunk);
    }

    private static Map<String, Object> prop(Prop p) {
        return obj(
                "id",
                p.id,
                "kind",
                camel(p.kind),
                "x",
                p.x,
                "y",
                p.y,
                "z",
                p.z,
                "rot",
                p.rot,
                "scale",
                p.scale,
                "chunk",
                p.chunk,
                "destroyed",
                p.destroyed,
                "node",
                p.node,
                "edge",
                p.edge);
    }

    private static Map<String, Object> container(Container c) {
        return obj("x", c.x(), "y", c.y(), "z", c.z(), "rot", c.rot(), "color", c.color(), "chunk", c.chunk());
    }

    private static Map<String, Object> parking(ParkingSpot p) {
        return obj("x", p.x(), "z", p.z(), "y", p.y(), "heading", p.heading());
    }

    private static Map<String, Object> sidewalk(SidewalkNode s) {
        return obj("id", s.id, "x", s.x, "z", s.z, "y", s.y, "links", s.links);
    }

    private static Map<String, Object> location(Location l) {
        return obj("x", l.x(), "y", l.y(), "z", l.z(), "heading", l.heading());
    }

    private static Map<String, Object> locations(Locations l) {
        return obj(
                "spawn", location(l.spawn()),
                "safehouseDoor", location(l.safehouseDoor()),
                "safehouseInside", location(l.safehouseInside()),
                "garage", location(l.garage()),
                "gunshopDoor", location(l.gunshopDoor()),
                "gunshopCounter", location(l.gunshopCounter()),
                "warehouseDoor", location(l.warehouseDoor()),
                "warehouseInside", location(l.warehouseInside()),
                "hospital", location(l.hospital()),
                "policeStation", location(l.policeStation()),
                "planeSpawn", location(l.planeSpawn()),
                "heliSpawn", location(l.heliSpawn()),
                "missionGivers", l.missionGivers().stream().map(Json::location).toList(),
                "missionPoints", l.missionPoints().stream().map(Json::location).toList());
    }

    // --- Missions et armes ----------------------------------------------------------

    public static List<Map<String, Object>> missions(List<MissionDef> defs) {
        return defs.stream()
                .map(d -> obj(
                        "id",
                        d.id(),
                        "title",
                        d.title(),
                        "brief",
                        d.brief(),
                        "reward",
                        d.reward(),
                        "giver",
                        pos(d.giver()),
                        "steps",
                        d.steps().stream().map(Json::step).toList()))
                .toList();
    }

    private static Map<String, Object> pos(Pos p) {
        return obj("x", p.x(), "z", p.z());
    }

    private static Boolean flag(boolean b) {
        return b ? Boolean.TRUE : null;
    }

    static Map<String, Object> step(Step s) {
        return switch (s) {
            case Step.Goto g ->
                obj(
                        "type",
                        "goto",
                        "text",
                        g.text(),
                        "pos",
                        pos(g.pos()),
                        "radius",
                        g.radius(),
                        "inVehicle",
                        flag(g.inVehicle()),
                        "onFoot",
                        flag(g.onFoot()));
            case Step.Deliver d ->
                obj(
                        "type",
                        "deliver",
                        "text",
                        d.text(),
                        "pos",
                        pos(d.pos()),
                        "radius",
                        d.radius(),
                        "timeLimit",
                        d.timeLimit(),
                        "requireTag",
                        d.requireTag());
            case Step.EnterVehicle e -> obj("type", "enterVehicle", "text", e.text(), "tag", e.tag());
            case Step.Eliminate e -> obj("type", "eliminate", "text", e.text(), "tags", e.tags());
            case Step.Destroy d -> obj("type", "destroy", "text", d.text(), "tag", d.tag());
            case Step.Escape e -> obj("type", "escape", "text", e.text());
            case Step.Wait w -> obj("type", "wait", "text", w.text(), "seconds", w.seconds());
        };
    }

    public static Map<String, Object> weapons() {
        Map<String, Object> out = new LinkedHashMap<>();
        for (WeaponId id : WeaponId.values()) {
            WeaponDef d = id.def();
            out.put(
                    camel(id),
                    obj(
                            "id",
                            camel(id),
                            "label",
                            d.label(),
                            "slot",
                            d.slot(),
                            "holding",
                            camel(d.holding()),
                            "damage",
                            d.damage(),
                            "interval",
                            d.interval(),
                            "magazine",
                            d.magazine(),
                            "reload",
                            d.reload(),
                            "auto",
                            d.auto(),
                            "spread",
                            d.spread(),
                            "range",
                            d.range(),
                            "pellets",
                            d.pellets(),
                            "zoomFov",
                            d.zoomFov(),
                            "melee",
                            flag(d.melee()),
                            "thrown",
                            flag(d.thrown()),
                            "price",
                            d.price(),
                            "ammoPrice",
                            d.ammoPrice(),
                            "ammoPack",
                            d.ammoPack(),
                            "noise",
                            d.noise()));
        }
        return out;
    }

    // --- Identifiants ------------------------------------------------------------------

    public static WeaponId weaponId(String id) {
        for (WeaponId w : WeaponId.values()) {
            if (camel(w).equals(id)) return w;
        }
        throw new IllegalArgumentException("arme inconnue : " + id);
    }
}
