package fr.tikigaming.games.mini_gta.world;

import java.util.List;

public record CityData(
        long seed,
        Terrain terrain,
        RoadNetwork roads,
        List<Block> blocks,
        List<Building> buildings,
        List<Prop> props,
        List<Container> containers,
        List<Location> cranes,
        List<ParkingSpot> parking,
        List<SidewalkNode> sidewalk,
        Locations locations) {}
