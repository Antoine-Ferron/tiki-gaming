package fr.tikigaming.games.mini_gta.world;

import java.util.ArrayList;
import java.util.List;

public record Locations(
        Location spawn,
        Location safehouseDoor,
        Location safehouseInside,
        Location garage,
        Location gunshopDoor,
        Location gunshopCounter,
        Location warehouseDoor,
        Location warehouseInside,
        Location hospital,
        Location policeStation,
        Location planeSpawn,
        Location heliSpawn,
        List<Location> missionGivers,
        List<Location> missionPoints) {

    /** Tous les lieux, listes comprises. */
    public List<Location> all() {
        List<Location> out = new ArrayList<>(List.of(
                spawn,
                safehouseDoor,
                safehouseInside,
                garage,
                gunshopDoor,
                gunshopCounter,
                warehouseDoor,
                warehouseInside,
                hospital,
                policeStation,
                planeSpawn,
                heliSpawn));
        out.addAll(missionGivers);
        out.addAll(missionPoints);
        return out;
    }
}
