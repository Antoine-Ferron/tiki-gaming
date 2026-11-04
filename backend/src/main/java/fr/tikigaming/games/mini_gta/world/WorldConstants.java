package fr.tikigaming.games.mini_gta.world;

/** Disposition du monde (mètres). X = est, Z = sud, Y = haut ; le nord est -Z. */
public final class WorldConstants {
    private WorldConstants() {}

    public record XZ(double x, double z) {}

    public static final int MAP_HALF = 1024;
    public static final int MAP_SIZE = MAP_HALF * 2;
    public static final int TERRAIN_RES = 4;
    public static final int TERRAIN_CELLS = MAP_SIZE / TERRAIN_RES;
    public static final int CHUNK_SIZE = 256;
    public static final int CHUNKS_PER_SIDE = MAP_SIZE / CHUNK_SIZE;
    public static final double WATER_LEVEL = -0.6;
    public static final double LANE_WIDTH = 3.5;
    public static final double SIDEWALK_WIDTH = 4;
    public static final double SLAB_HEIGHT = 0.15;

    public static final class Grid {
        public static final double MIN_X = -680;
        public static final double MAX_X = 680;
        public static final double MIN_Z = -480;
        public static final double MAX_Z = 780;
    }

    public static final class Ring {
        public static final double MIN_X = -760;
        public static final double MAX_X = 760;
        public static final double MIN_Z = -560;
        public static final double MAX_Z = 860;
        public static final double RADIUS = 70;
    }

    public static final double HILL_TOP_Z = -880;

    public static final class Port {
        public static final double MAX_X = -420;
        public static final double MIN_Z = 200;
        public static final double QUAY_MIN_Z = 260;
        public static final double QUAY_MAX_Z = 760;
    }

    public static final class Downtown {
        public static final double X = 60;
        public static final double Z = 160;
        public static final double RADIUS = 330;
    }

    public static final double COMMERCIAL_RADIUS = 620;

    public static final class Airfield {
        public static final double RUNWAY_X = 905;
        public static final double MIN_Z = -420;
        public static final double MAX_Z = 520;
        public static final double WIDTH = 46;
        public static final double APRON_X = 835;
        public static final double APRON_Z = 0;
    }

    public static double shoreX(double z) {
        if (isPortQuay(z)) return -830;
        return -830 + 16 * Math.sin(z * 0.006) + 9 * Math.sin(z * 0.017 + 1);
    }

    public static boolean isPortQuay(double z) {
        return z > Port.QUAY_MIN_Z && z < Port.QUAY_MAX_Z;
    }

    public static District districtAt(double x, double z) {
        if (z < Ring.MIN_Z - 10) return District.HILLS;
        if (x > Ring.MAX_X + 10) return District.AIRFIELD;
        if (x < Port.MAX_X && z > Port.MIN_Z) return District.PORT;
        double d = Math.hypot(x - Downtown.X, z - Downtown.Z);
        if (d < Downtown.RADIUS) return District.DOWNTOWN;
        if (d < COMMERCIAL_RADIUS) return District.COMMERCIAL;
        return District.SUBURB;
    }

    public static int chunkIndexOf(double x, double z) {
        int cx = (int) Math.min(CHUNKS_PER_SIDE - 1, Math.max(0, Math.floor((x + MAP_HALF) / CHUNK_SIZE)));
        int cz = (int) Math.min(CHUNKS_PER_SIDE - 1, Math.max(0, Math.floor((z + MAP_HALF) / CHUNK_SIZE)));
        return cz * CHUNKS_PER_SIDE + cx;
    }

    public static XZ chunkCenter(int index) {
        int cx = index % CHUNKS_PER_SIDE;
        int cz = index / CHUNKS_PER_SIDE;
        return new XZ(-MAP_HALF + (cx + 0.5) * CHUNK_SIZE, -MAP_HALF + (cz + 0.5) * CHUNK_SIZE);
    }
}
