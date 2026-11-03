package fr.tikigaming.games.mini_gta.world;

import static fr.tikigaming.games.mini_gta.world.WorldConstants.SIDEWALK_WIDTH;
import static fr.tikigaming.games.mini_gta.world.WorldConstants.SLAB_HEIGHT;
import static fr.tikigaming.games.mini_gta.world.WorldConstants.chunkIndexOf;

import fr.tikigaming.games.mini_gta.core.MathUtil;
import fr.tikigaming.games.mini_gta.core.Rng;
import fr.tikigaming.games.mini_gta.world.WorldConstants.Airfield;
import fr.tikigaming.games.mini_gta.world.WorldConstants.Downtown;
import fr.tikigaming.games.mini_gta.world.WorldConstants.Ring;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Génération déterministe de la ville : îlots, parcelles, bâtiments, conteneurs, mobilier, trottoirs
 * et lieux clés. Tous les tirages passent par des sous-flux {@link Rng} : même graine, même ville.
 */
public final class CityGenerator {

    private static final Map<FacadeStyle, List<double[]>> WALL_COLORS = new EnumMap<>(Map.of(
            FacadeStyle.GLASS_TOWER,
                    List.of(new double[] {0.25, 0.28, 0.32}, new double[] {0.18, 0.2, 0.24}, new double[] {
                        0.55, 0.57, 0.6
                    }),
            FacadeStyle.OFFICE,
                    List.of(new double[] {0.72, 0.7, 0.66}, new double[] {0.6, 0.6, 0.62}, new double[] {
                        0.78, 0.74, 0.66
                    }),
            FacadeStyle.BRICK,
                    List.of(new double[] {0.55, 0.3, 0.22}, new double[] {0.62, 0.42, 0.3}, new double[] {
                        0.45, 0.28, 0.24
                    }),
            FacadeStyle.HOUSE,
                    List.of(
                            new double[] {0.92, 0.88, 0.8},
                            new double[] {0.8, 0.86, 0.9},
                            new double[] {0.95, 0.85, 0.7},
                            new double[] {0.75, 0.82, 0.72}),
            FacadeStyle.WAREHOUSE,
                    List.of(new double[] {0.5, 0.55, 0.6}, new double[] {0.6, 0.5, 0.4}, new double[] {0.45, 0.5, 0.45
                    }),
            FacadeStyle.SHOP, List.of(new double[] {0.85, 0.8, 0.72}, new double[] {0.7, 0.72, 0.75})));

    private static final List<double[]> CONTAINER_COLORS = List.of(
            new double[] {0.7, 0.15, 0.1},
            new double[] {0.1, 0.35, 0.6},
            new double[] {0.15, 0.5, 0.25},
            new double[] {0.8, 0.55, 0.1},
            new double[] {0.5, 0.5, 0.52});

    private static final Map<District, Double> MAX_LOT = new EnumMap<>(Map.of(
            District.DOWNTOWN,
            48.0,
            District.COMMERCIAL,
            36.0,
            District.SUBURB,
            30.0,
            District.PORT,
            60.0,
            District.HILLS,
            30.0,
            District.AIRFIELD,
            60.0));

    /** Vecteurs unitaires des quatre côtés : 0 = -z, 1 = +x, 2 = +z, 3 = -x. */
    private static final int[][] SIDES = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};

    /** Bâtiment spécial à placer ; {@code size} (demi-largeur, demi-profondeur, hauteur) est facultatif. */
    private record SpecialSpec(SpecialKind kind, Set<District> districts, double nearX, double nearZ, double[] size) {
        @Override
        public boolean equals(Object o) {
            return o instanceof SpecialSpec s
                    && kind == s.kind
                    && districts.equals(s.districts)
                    && Double.compare(nearX, s.nearX) == 0
                    && Double.compare(nearZ, s.nearZ) == 0
                    && Arrays.equals(size, s.size);
        }

        @Override
        public int hashCode() {
            return Objects.hash(kind, districts, nearX, nearZ) * 31 + Arrays.hashCode(size);
        }

        @Override
        public String toString() {
            return "SpecialSpec[" + kind + ", " + districts + ", " + nearX + ", " + nearZ + ", " + Arrays.toString(size)
                    + "]";
        }
    }

    /** Case de la grille des îlots (clé du graphe piéton). */
    private record GridCell(int i, int j) {}

    private record Placed(Building building, Block block) {}

    private final Rng rng;
    private final RoadNetwork roads;
    private final RoadGraph g;
    private final Terrain terrain;
    private Rng r;
    private final List<Block> blocks = new ArrayList<>();
    private final List<Building> buildings = new ArrayList<>();
    private final List<Container> containers = new ArrayList<>();
    private final List<Location> cranes = new ArrayList<>();
    private final List<Prop> props = new ArrayList<>();
    private final List<ParkingSpot> parking = new ArrayList<>();
    private final List<SidewalkNode> sidewalk = new ArrayList<>();
    private Rect currentLot;

    private CityGenerator(long seed) {
        rng = new Rng(seed);
        roads = Roads.generate(rng);
        terrain = new Terrain(rng);
        g = roads.graph();
    }

    public static CityData generate(long seed) {
        return new CityGenerator(seed).run(seed);
    }

    private CityData run(long seed) {
        // Aplanit le terrain sous les routes de colline, puis cale les nœuds routiers sur le sol.
        for (Polyline line : roads.hillLines()) terrain.flattenAlong(line);
        for (RoadNode n : g.nodes) n.y = terrain.heightAt(n.x, n.z);

        r = rng.fork("city");
        generateBlocks();
        generateBuildings();
        generateQuay();
        generateHillVillas();
        Map<SpecialKind, Placed> specials = placeSpecials();
        generateStreetProps();
        generateBlockProps();
        generateNatureProps();
        generateSidewalks();
        Locations locations = locations(specials);

        return new CityData(
                seed,
                terrain,
                roads,
                List.copyOf(blocks),
                List.copyOf(buildings),
                List.copyOf(props),
                List.copyOf(containers),
                List.copyOf(cranes),
                List.copyOf(parking),
                List.copyOf(sidewalk),
                locations);
    }

    // --- Îlots -------------------------------------------------------------------------------

    private static double halfW(RoadKind k) {
        return k.width / 2;
    }

    private void addBlock(Rect rect, int gi, int gj) {
        if (rect.width() < 20 || rect.depth() < 20) return;
        double cx = (rect.x0() + rect.x1()) / 2;
        double cz = (rect.z0() + rect.z1()) / 2;
        District district = WorldConstants.districtAt(cx, cz);
        boolean park = district != District.PORT && gi >= 0 && r.chance(district == District.DOWNTOWN ? 0.06 : 0.09);
        blocks.add(new Block(blocks.size(), rect.x0(), rect.x1(), rect.z0(), rect.z1(), district, park, gi, gj));
    }

    private void generateBlocks() {
        List<Double> xs = roads.xs();
        List<Double> zs = roads.zs();
        List<RoadKind> kindX = roads.kindX();
        List<RoadKind> kindZ = roads.kindZ();
        double ringHalf = RoadKind.HIGHWAY.width / 2;
        int nx = xs.size();
        int nz = zs.size();
        for (int i = 0; i < nx - 1; i++) {
            for (int j = 0; j < nz - 1; j++) {
                addBlock(
                        new Rect(
                                xs.get(i) + halfW(kindX.get(i)),
                                xs.get(i + 1) - halfW(kindX.get(i + 1)),
                                zs.get(j) + halfW(kindZ.get(j)),
                                zs.get(j + 1) - halfW(kindZ.get(j + 1))),
                        i,
                        j);
            }
        }
        // Bandes extérieures entre la bordure de la grille et le périphérique.
        for (int j = 0; j < nz - 1; j++) {
            double z0 = zs.get(j) + halfW(kindZ.get(j));
            double z1 = zs.get(j + 1) - halfW(kindZ.get(j + 1));
            addBlock(new Rect(Ring.MIN_X + ringHalf, xs.get(0) - halfW(kindX.get(0)), z0, z1), -1, j);
            addBlock(new Rect(xs.get(nx - 1) + halfW(kindX.get(nx - 1)), Ring.MAX_X - ringHalf, z0, z1), -1, j);
        }
        for (int i = 0; i < nx - 1; i++) {
            double x0 = xs.get(i) + halfW(kindX.get(i));
            double x1 = xs.get(i + 1) - halfW(kindX.get(i + 1));
            addBlock(new Rect(x0, x1, Ring.MIN_Z + ringHalf, zs.get(0) - halfW(kindZ.get(0))), i, -1);
            addBlock(new Rect(x0, x1, zs.get(nz - 1) + halfW(kindZ.get(nz - 1)), Ring.MAX_Z - ringHalf), i, -1);
        }
    }

    // --- Bâtiments ---------------------------------------------------------------------------

    static void splitLots(Rect rect, double maxSize, Rng rng, List<Rect> out, int depth) {
        double w = rect.width();
        double d = rect.depth();
        if ((w <= maxSize && d <= maxSize) || depth > 8) {
            out.add(rect);
            return;
        }
        double t = rng.range(0.38, 0.62);
        if (w > d) {
            double m = rect.x0() + w * t;
            splitLots(new Rect(rect.x0(), m, rect.z0(), rect.z1()), maxSize, rng, out, depth + 1);
            splitLots(new Rect(m, rect.x1(), rect.z0(), rect.z1()), maxSize, rng, out, depth + 1);
        } else {
            double m = rect.z0() + d * t;
            splitLots(new Rect(rect.x0(), rect.x1(), rect.z0(), m), maxSize, rng, out, depth + 1);
            splitLots(new Rect(rect.x0(), rect.x1(), m, rect.z1()), maxSize, rng, out, depth + 1);
        }
    }

    private Building addBuilding(Building b) {
        b.id = buildings.size();
        b.chunk = chunkIndexOf(b.x, b.z);
        b.lot = currentLot;
        buildings.add(b);
        return b;
    }

    private double[] pickColor(FacadeStyle style) {
        double[] c = r.pick(WALL_COLORS.get(style));
        double v = r.range(0.9, 1.08);
        return new double[] {c[0] * v, c[1] * v, c[2] * v};
    }

    private static double roundToFloor(double h) {
        return Math.round(h / 3.5) * 3.5;
    }

    private void generateBuildings() {
        Map<Integer, List<Rect>> lotsByBlock = new HashMap<>();
        for (Block block : blocks) {
            if (block.park()) continue;
            Rect inner = new Rect(
                    block.x0() + SIDEWALK_WIDTH,
                    block.x1() - SIDEWALK_WIDTH,
                    block.z0() + SIDEWALK_WIDTH,
                    block.z1() - SIDEWALK_WIDTH);
            List<Rect> lots = new ArrayList<>();
            splitLots(inner, MAX_LOT.get(block.district()), r, lots, 0);
            lotsByBlock.put(block.id(), lots);
        }

        for (Block block : blocks) {
            List<Rect> lots = lotsByBlock.get(block.id());
            if (lots == null) continue;
            for (Rect lot : lots) {
                double lw = lot.width();
                double ld = lot.depth();
                double cx = (lot.x0() + lot.x1()) / 2;
                double cz = (lot.z0() + lot.z1()) / 2;
                if (lw < 8 || ld < 8) continue;
                double y0 = SLAB_HEIGHT;
                currentLot = lot;
                switch (block.district()) {
                    case DOWNTOWN -> {
                        double d = Math.min(1, Math.hypot(cx - Downtown.X, cz - Downtown.Z) / Downtown.RADIUS);
                        double inset = r.range(1.5, 3.5);
                        double h = roundToFloor(30 + 150 * Math.pow(1 - d, 1.6) * r.range(0.45, 1.15));
                        FacadeStyle style = r.chance(0.55) ? FacadeStyle.GLASS_TOWER : FacadeStyle.OFFICE;
                        double hw = lw / 2 - inset;
                        double hd = ld / 2 - inset;
                        Building.Tier tier = h > 70 && r.chance(0.5)
                                ? new Building.Tier(
                                        hw * r.range(0.6, 0.8),
                                        hd * r.range(0.6, 0.8),
                                        Math.round(h * r.range(0.25, 0.5)))
                                : null;
                        addBuilding(new Building(cx, cz, hw, hd, y0, h, 0, style, pickColor(style), Roof.FLAT, tier));
                    }
                    case COMMERCIAL -> {
                        double inset = r.range(1, 3);
                        FacadeStyle style = r.pick(
                                List.of(FacadeStyle.OFFICE, FacadeStyle.BRICK, FacadeStyle.SHOP, FacadeStyle.BRICK));
                        double h = roundToFloor(r.range(8, 32));
                        addBuilding(new Building(
                                cx,
                                cz,
                                lw / 2 - inset,
                                ld / 2 - inset,
                                y0,
                                h,
                                0,
                                style,
                                pickColor(style),
                                Roof.FLAT,
                                null));
                    }
                    case SUBURB -> {
                        double hw = Math.min(lw / 2 - 3, r.range(5, 7.5));
                        double hd = Math.min(ld / 2 - 3, r.range(4.5, 6.5));
                        if (hw < 3.5 || hd < 3.5) break;
                        double x = cx + r.range(-1, 1);
                        double z = cz + r.range(-1, 1);
                        double h = r.range(3.2, 6.5);
                        addBuilding(new Building(
                                x,
                                z,
                                hw,
                                hd,
                                y0,
                                h,
                                0,
                                FacadeStyle.HOUSE,
                                pickColor(FacadeStyle.HOUSE),
                                Roof.GABLE,
                                null));
                    }
                    case PORT -> {
                        if (r.chance(0.55)) {
                            double h = r.range(9, 15);
                            addBuilding(new Building(
                                    cx,
                                    cz,
                                    lw / 2 - 4,
                                    ld / 2 - 4,
                                    y0,
                                    h,
                                    0,
                                    FacadeStyle.WAREHOUSE,
                                    pickColor(FacadeStyle.WAREHOUSE),
                                    Roof.FLAT,
                                    null));
                        } else {
                            addContainerYard(lot, y0);
                        }
                    }
                    default -> {}
                }
            }
        }
        currentLot = null;
    }

    private void addContainerYard(Rect lot, double y0) {
        int rows = (int) Math.floor((lot.depth() - 6) / 4);
        int cols = (int) Math.floor((lot.width() - 6) / 13);
        for (int a = 0; a < cols; a++) {
            for (int b = 0; b < rows; b++) {
                if (r.chance(0.25)) continue;
                int stack = r.nextInt(1, 3);
                for (int s = 0; s < stack; s++) {
                    double x = lot.x0() + 3 + 6.5 + a * 13;
                    double z = lot.z0() + 3 + 2 + b * 4;
                    containers.add(new Container(
                            x, y0 + 1.3 + s * 2.6, z, Math.PI / 2, r.pick(CONTAINER_COLORS), chunkIndexOf(x, z)));
                }
            }
        }
    }

    /** Quai : grues et piles de conteneurs entre le périphérique et l'eau. */
    private void generateQuay() {
        for (int z = 300; z < 740; z += 75) cranes.add(new Location(-808, 0, z));
        for (int z = 290; z < 740; z += 9) {
            if (r.chance(0.35)) continue;
            int stack = r.nextInt(1, 3);
            for (int s = 0; s < stack; s++) {
                double x = -785 + (r.chance(0.5) ? 0 : 3);
                containers.add(new Container(x, 1.3 + s * 2.6, z, 0, r.pick(CONTAINER_COLORS), chunkIndexOf(x, z)));
            }
        }
    }

    private double hillDist(double x, double z) {
        double best = Double.POSITIVE_INFINITY;
        for (Polyline line : roads.hillLines()) {
            List<Polyline.Point> pts = line.points();
            for (int k = 0; k < pts.size() - 1; k++) {
                Polyline.Point a = pts.get(k);
                Polyline.Point b = pts.get(k + 1);
                best = Math.min(
                        best,
                        MathUtil.pointSegment(x, z, a.x(), a.z(), b.x(), b.z()).d());
            }
        }
        return best;
    }

    /** Villas le long des routes sinueuses des collines. */
    private void generateHillVillas() {
        for (Polyline line : roads.hillLines()) {
            List<Polyline.Point> pts = line.points();
            for (int k = 2; k < pts.size() - 1; k += 2) {
                Polyline.Point a = pts.get(k - 1);
                Polyline.Point b = pts.get(k);
                double dx = b.x() - a.x();
                double dz = b.z() - a.z();
                double len = Math.hypot(dx, dz);
                int side = k % 4 == 0 ? 1 : -1;
                double x = b.x() + (-dz / len) * side * 17;
                double z = b.z() + (dx / len) * side * 17;
                double hw = 7;
                double hd = 5.5;
                if (hillDist(x, z) < 13 || z > Ring.MIN_Z - 30) continue;
                double lo = Double.POSITIVE_INFINITY;
                double hi = Double.NEGATIVE_INFINITY;
                for (int sx = -1; sx <= 1; sx += 2) {
                    for (int sz = -1; sz <= 1; sz += 2) {
                        double h = terrain.heightAt(x + sx * hw, z + sz * hd);
                        lo = Math.min(lo, h);
                        hi = Math.max(hi, h);
                    }
                }
                if (hi - lo > 6) continue;
                if (anyBuildingWithin(x, z, 20)) continue;
                double h = hi - lo + 3 + r.range(5, 7);
                addBuilding(new Building(
                        x,
                        z,
                        hw,
                        hd,
                        lo - 3,
                        h,
                        -Math.atan2(dz, dx),
                        FacadeStyle.HOUSE,
                        pickColor(FacadeStyle.HOUSE),
                        Roof.FLAT,
                        null));
            }
        }
    }

    private boolean anyBuildingWithin(double x, double z, double dist) {
        for (Building o : buildings) {
            if (Math.hypot(o.x - x, o.z - z) < dist) return true;
        }
        return false;
    }

    // --- Bâtiments spéciaux --------------------------------------------------------------------

    private Block blockOf(Building b) {
        for (Block bl : blocks) {
            if (bl.containsStrict(b.x, b.z)) return bl;
        }
        return null;
    }

    private Block blockAt(double x, double z) {
        for (Block bl : blocks) {
            if (bl.containsInclusive(x, z)) return bl;
        }
        return null;
    }

    private static int indexOfMin(double[] values) {
        int best = 0;
        for (int i = 1; i < values.length; i++) {
            if (values[i] < values[best]) best = i;
        }
        return best;
    }

    /** Remplace, pour chaque spécial, le bâtiment adapté le plus proche du point visé. */
    private Map<SpecialKind, Placed> placeSpecials() {
        List<SpecialSpec> specs = List.of(
                new SpecialSpec(SpecialKind.SAFEHOUSE, Set.of(District.SUBURB), 470, 640, new double[] {7, 6, 4.2}),
                new SpecialSpec(SpecialKind.GUNSHOP, Set.of(District.COMMERCIAL), -260, 380, new double[] {9, 7, 5}),
                new SpecialSpec(SpecialKind.WAREHOUSE, Set.of(District.PORT), -600, 520, new double[] {16, 12, 9}),
                new SpecialSpec(SpecialKind.HOSPITAL, Set.of(District.COMMERCIAL, District.DOWNTOWN), 380, -60, null),
                new SpecialSpec(SpecialKind.POLICE, Set.of(District.COMMERCIAL), -330, -160, null));
        Map<SpecialKind, Placed> placed = new EnumMap<>(SpecialKind.class);
        for (SpecialSpec s : specs) {
            Building best = null;
            double bestD = Double.POSITIVE_INFINITY;
            for (Building b : buildings) {
                if (b.special != null || b.rot != 0) continue;
                Block bl = blockOf(b);
                if (bl == null || !s.districts().contains(bl.district())) continue;
                Rect lot = b.lot;
                if (lot == null) continue;
                if (s.size() != null && (lot.width() < s.size()[0] * 2 + 3 || lot.depth() < s.size()[1] * 2 + 3)) {
                    continue;
                }
                double d = Math.hypot(b.x - s.nearX(), b.z - s.nearZ());
                if (d < bestD) {
                    bestD = d;
                    best = b;
                }
            }
            if (best == null) throw new IllegalStateException("Aucune parcelle pour " + s.kind());
            Block block = blockOf(best);
            best.special = s.kind();
            if (s.size() != null) makeEnterable(best, block, s);
            if (s.kind() == SpecialKind.HOSPITAL) {
                best.style = FacadeStyle.OFFICE;
                best.color = new double[] {0.92, 0.93, 0.95};
            }
            if (s.kind() == SpecialKind.POLICE) {
                best.style = FacadeStyle.OFFICE;
                best.color = new double[] {0.35, 0.42, 0.55};
            }
            placed.put(s.kind(), new Placed(best, block));
        }
        return placed;
    }

    private static void makeEnterable(Building best, Block block, SpecialSpec s) {
        // Porte du côté du bord d'îlot le plus proche (la rue).
        int doorSide = indexOfMin(
                new double[] {best.z - block.z0(), block.x1() - best.x, block.z1() - best.z, best.x - block.x0()});
        best.hw = s.size()[0];
        best.hd = s.size()[1];
        best.h = s.size()[2];
        best.tier = null;
        best.roof = Roof.FLAT;
        best.doorSide = doorSide;
        if (s.kind() == SpecialKind.GUNSHOP) {
            best.style = FacadeStyle.SHOP;
            best.color = new double[] {0.35, 0.37, 0.4};
        }
        if (s.kind() == SpecialKind.SAFEHOUSE) best.style = FacadeStyle.HOUSE;
        // Pousse le bâtiment vers la rue pour que la porte soit près du trottoir.
        Rect lot = best.lot;
        double room =
                new double[] {best.z - lot.z0(), lot.x1() - best.x, lot.z1() - best.z, best.x - lot.x0()}[doorSide];
        double push = Math.max(0, room - (doorSide % 2 == 0 ? best.hd : best.hw) - 1);
        best.x += SIDES[doorSide][0] * push;
        best.z += SIDES[doorSide][1] * push;
    }

    // --- Mobilier ----------------------------------------------------------------------------

    private void addProp(PropKind kind, double x, double z, double rot, double scale, double y) {
        addProp(kind, x, z, rot, scale, y, null, null);
    }

    private void addProp(
            PropKind kind, double x, double z, double rot, double scale, double y, Integer node, Integer edge) {
        props.add(new Prop(props.size(), kind, x, y, z, rot, scale, node, edge));
    }

    /** Lampadaires et stationnement le long des tronçons, feux aux carrefours. */
    private void generateStreetProps() {
        for (RoadEdge e : g.edges) {
            RoadNode a = g.nodes.get(e.a());
            RoadNode b = g.nodes.get(e.b());
            double dx = (b.x - a.x) / e.length();
            double dz = (b.z - a.z) / e.length();
            double trimA = a.radius + 4;
            double trimB = b.radius + 4;
            for (int side : new int[] {1, -1}) {
                double off = e.width() / 2 + 0.8;
                if (e.kind() == RoadKind.HILL && side == -1) continue;
                double step = e.kind() == RoadKind.HIGHWAY ? 45 : 34;
                for (double s = trimA + 6; s < e.length() - trimB; s += step) {
                    double x = a.x + dx * s - dz * off * side;
                    double z = a.z + dz * s + dx * off * side;
                    boolean onBlock = blockAt(x, z) != null;
                    if (e.kind() != RoadKind.HIGHWAY && e.kind() != RoadKind.HILL && !onBlock) continue;
                    double y = terrain.heightAt(x, z) + (onBlock ? SLAB_HEIGHT : 0);
                    // Le lampadaire fait face à la route.
                    addProp(PropKind.LAMP, x, z, Math.atan2(dz * side, -dx * side), 1, y);
                }
                if (e.kind() == RoadKind.STREET || e.kind() == RoadKind.AVENUE) {
                    double poff = e.width() / 2 - 1.25;
                    for (double s = trimA + 8; s < e.length() - trimB - 4; s += 9) {
                        if (r.chance(0.4)) continue;
                        double x = a.x + dx * s - dz * poff * side;
                        double z = a.z + dz * s + dx * poff * side;
                        parking.add(new ParkingSpot(x, z, terrain.heightAt(x, z), Math.atan2(dx * side, dz * side)));
                    }
                }
            }
        }
        for (RoadNode n : g.nodes) {
            if (!n.light) continue;
            for (int id : n.edges) {
                RoadEdge e = g.edges.get(id);
                RoadNode o = g.other(e, n.id);
                double len = Math.hypot(o.x - n.x, o.z - n.z);
                double dx = (o.x - n.x) / len;
                double dz = (o.z - n.z) / len;
                // Mât au coin droit de l'approche (le trafic arrive de o vers n).
                double off = e.width() / 2 + 1;
                double x = n.x + dx * (n.radius + 1) + dz * off;
                double z = n.z + dz * (n.radius + 1) - dx * off;
                addProp(PropKind.TRAFFIC_LIGHT, x, z, Math.atan2(dx, dz), 1, SLAB_HEIGHT, n.id, e.id());
            }
        }
    }

    /** Mobilier d'îlot, parcs et arbres d'alignement. */
    private void generateBlockProps() {
        for (Block block : blocks) {
            double sx = block.x1() - block.x0();
            double sz = block.z1() - block.z0();
            if (block.district() == District.SUBURB) {
                for (double x = block.x0() + 6; x < block.x1() - 4; x += 13) {
                    addProp(PropKind.TREE, x, block.z0() + 1.8, r.range(0, 6.28), r.range(0.8, 1.2), SLAB_HEIGHT);
                    addProp(PropKind.TREE, x, block.z1() - 1.8, r.range(0, 6.28), r.range(0.8, 1.2), SLAB_HEIGHT);
                }
            }
            if (block.park()) {
                int count = (int) Math.floor((sx * sz) / 160);
                for (int k = 0; k < count; k++) {
                    addProp(
                            PropKind.TREE,
                            r.range(block.x0() + 7, block.x1() - 7),
                            r.range(block.z0() + 7, block.z1() - 7),
                            r.range(0, 6.28),
                            r.range(0.8, 1.4),
                            SLAB_HEIGHT);
                }
                for (int k = 0; k < 4; k++) {
                    addProp(PropKind.BENCH, r.range(block.x0() + 8, block.x1() - 8), block.z0() + 5, 0, 1, SLAB_HEIGHT);
                }
            }
            if (block.district() == District.DOWNTOWN || block.district() == District.COMMERCIAL) {
                int n = r.nextInt(2, 4);
                for (int k = 0; k < n; k++) {
                    boolean along = r.chance(0.5);
                    double x = along
                            ? r.range(block.x0() + 6, block.x1() - 6)
                            : r.chance(0.5) ? block.x0() + 1.2 : block.x1() - 1.2;
                    double z = along
                            ? (r.chance(0.5) ? block.z0() + 1.2 : block.z1() - 1.2)
                            : r.range(block.z0() + 6, block.z1() - 6);
                    addProp(PropKind.BIN, x, z, r.range(0, 6.28), 1, SLAB_HEIGHT);
                }
            }
            if (block.district() != District.PORT) {
                addProp(PropKind.HYDRANT, block.x0() + 1.2, block.z0() + r.range(8, sz - 8), 0, 1, SLAB_HEIGHT);
                if (r.chance(0.5)) {
                    addProp(PropKind.HYDRANT, block.x1() - 1.2, block.z0() + r.range(8, sz - 8), 0, 1, SLAB_HEIGHT);
                }
            }
        }
    }

    /** Palmiers de la promenade côtière, forêts des collines et de la bordure. */
    private void generateNatureProps() {
        for (double z = Ring.MIN_Z + 40; z < Ring.MAX_Z - 40; z += 22) {
            double x = Ring.MIN_X - 14;
            if (x - WorldConstants.shoreX(z) < 6) continue;
            if (z > 280 && z < 750) continue;
            addProp(PropKind.PALM, x, z, r.range(0, 6.28), r.range(0.9, 1.2), terrain.heightAt(x, z));
        }
        for (int k = 0; k < 2600; k++) {
            double x = r.range(-1010, 1010);
            double z = r.range(-1010, 1010);
            boolean inHills = z < Ring.MIN_Z - 20;
            boolean inBorder = x > 975
                    || z > Ring.MAX_Z + 20
                    || (x > Ring.MAX_X + 15
                            && Math.abs(x - Airfield.RUNWAY_X) > 50
                            && Math.abs(x - Airfield.APRON_X) > 50);
            if (!inHills && !inBorder) continue;
            if (x - WorldConstants.shoreX(z) < 10) continue;
            if (inHills && hillDist(x, z) < 9) continue;
            if (villaNear(x, z)) continue;
            if (z > Ring.MAX_Z - 10 && z < Ring.MAX_Z + 20) continue;
            addProp(PropKind.TREE, x, z, r.range(0, 6.28), r.range(0.9, 1.6), terrain.heightAt(x, z));
        }
    }

    private boolean villaNear(double x, double z) {
        for (Building b : buildings) {
            if (b.rot != 0 && Math.abs(b.x - x) < b.hw + 6 && Math.abs(b.z - z) < b.hw + 6) return true;
        }
        return false;
    }

    // --- Trottoirs ---------------------------------------------------------------------------

    private int addSidewalk(double x, double z) {
        SidewalkNode n = new SidewalkNode(sidewalk.size(), x, z, SLAB_HEIGHT);
        sidewalk.add(n);
        return n.id;
    }

    private void link(int a, int b) {
        sidewalk.get(a).links.add(b);
        sidewalk.get(b).links.add(a);
    }

    /** Graphe piéton : quatre coins par îlot de la grille, reliés aux îlots voisins. */
    private void generateSidewalks() {
        Map<GridCell, int[]> cornerIds = new LinkedHashMap<>();
        for (Block block : blocks) {
            if (block.gi() < 0 || block.gj() < 0 || block.district() == District.PORT) continue;
            double i = 2;
            int[] c = {
                addSidewalk(block.x0() + i, block.z0() + i),
                addSidewalk(block.x1() - i, block.z0() + i),
                addSidewalk(block.x1() - i, block.z1() - i),
                addSidewalk(block.x0() + i, block.z1() - i),
            };
            for (int k = 0; k < 4; k++) link(c[k], c[(k + 1) % 4]);
            cornerIds.put(new GridCell(block.gi(), block.gj()), c);
        }
        for (Map.Entry<GridCell, int[]> entry : cornerIds.entrySet()) {
            int i = entry.getKey().i();
            int j = entry.getKey().j();
            int[] c = entry.getValue();
            int[] right = cornerIds.get(new GridCell(i + 1, j));
            if (right != null) {
                link(c[1], right[0]);
                link(c[2], right[3]);
            }
            int[] down = cornerIds.get(new GridCell(i, j + 1));
            if (down != null) {
                link(c[3], down[0]);
                link(c[2], down[1]);
            }
        }
    }

    // --- Lieux -------------------------------------------------------------------------------

    private static Location doorOf(Building b, double outside) {
        int side = b.doorSide;
        int dx = SIDES[side][0];
        int dz = SIDES[side][1];
        double ext = side % 2 == 0 ? b.hd : b.hw;
        return new Location(b.x + dx * (ext + outside), SLAB_HEIGHT, b.z + dz * (ext + outside), Math.atan2(dx, dz));
    }

    /** Point du trottoir sur le bord d'îlot le plus proche d'un bâtiment (toujours accessible depuis la rue). */
    private static Location frontOf(Building b, Block block) {
        int side = indexOfMin(new double[] {b.z - block.z0(), block.x1() - b.x, block.z1() - b.z, b.x - block.x0()});
        double inset = 2;
        double[][] pts = {
            {b.x, block.z0() + inset}, {block.x1() - inset, b.z}, {b.x, block.z1() - inset}, {block.x0() + inset, b.z},
        };
        double px = pts[side][0];
        double pz = pts[side][1];
        return new Location(px, SLAB_HEIGHT, pz, Math.atan2(b.x - px, b.z - pz));
    }

    private ParkingSpot nearestParking(double x, double z) {
        ParkingSpot best = parking.get(0);
        for (ParkingSpot p : parking) {
            if (Math.hypot(p.x() - x, p.z() - z) < Math.hypot(best.x() - x, best.z() - z)) best = p;
        }
        return best;
    }

    private Location nearestSidewalk(double x, double z) {
        SidewalkNode best = sidewalk.get(0);
        for (SidewalkNode s : sidewalk) {
            if (Math.hypot(s.x - x, s.z - z) < Math.hypot(best.x - x, best.z - z)) best = s;
        }
        return new Location(best.x, best.y, best.z);
    }

    private static Location toLocation(ParkingSpot p) {
        return new Location(p.x(), p.y(), p.z(), p.heading());
    }

    private Locations locations(Map<SpecialKind, Placed> specials) {
        Building safe = specials.get(SpecialKind.SAFEHOUSE).building();
        Building gun = specials.get(SpecialKind.GUNSHOP).building();
        Building wh = specials.get(SpecialKind.WAREHOUSE).building();
        Placed hospital = specials.get(SpecialKind.HOSPITAL);
        Placed police = specials.get(SpecialKind.POLICE);
        Location safehouseDoor = doorOf(safe, 1.5);
        Location gunshopDoor = doorOf(gun, 1.5);
        Location warehouseDoor = doorOf(wh, 2);
        double runwayHeading = Math.PI; // face à -z (nord)
        return new Locations(
                safehouseDoor,
                safehouseDoor,
                new Location(safe.x, SLAB_HEIGHT, safe.z),
                toLocation(nearestParking(safehouseDoor.x(), safehouseDoor.z())),
                gunshopDoor,
                new Location(gun.x, SLAB_HEIGHT, gun.z),
                warehouseDoor,
                new Location(wh.x, SLAB_HEIGHT, wh.z),
                frontOf(hospital.building(), hospital.block()),
                frontOf(police.building(), police.block()),
                new Location(Airfield.RUNWAY_X, 0, Airfield.MAX_Z - 40, runwayHeading),
                new Location(Airfield.APRON_X, 0, Airfield.APRON_Z + 40),
                List.of(
                        nearestSidewalk(40, 280),
                        nearestSidewalk(330, 120),
                        nearestSidewalk(-330, 430),
                        nearestSidewalk(safehouseDoor.x() - 60, safehouseDoor.z() - 40)),
                List.of(
                        nearestSidewalk(-420, -300), // M1 : enlèvement
                        nearestSidewalk(560, 700), // M1 : livraison
                        toLocation(nearestParking(-520, -380)))); // M4 : voiture spéciale
    }
}
