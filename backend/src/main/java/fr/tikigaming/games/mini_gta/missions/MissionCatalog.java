package fr.tikigaming.games.mini_gta.missions;

import fr.tikigaming.games.mini_gta.world.Location;
import fr.tikigaming.games.mini_gta.world.Locations;
import java.util.List;

/** Les quatre missions de l'histoire, construites à partir des lieux de la ville. */
public final class MissionCatalog {
    private MissionCatalog() {}

    /** Vitesse moyenne attendue (m/s) pour le chrono du colis, plus une marge fixe (s). */
    private static final double EXPRESS_SPEED = 11;

    private static final double EXPRESS_MARGIN = 35;

    private static Pos pos(Location l) {
        return new Pos(l.x(), l.z());
    }

    static double expressTimeLimit(Location pickup, Location delivery) {
        double d = Math.hypot(delivery.x() - pickup.x(), delivery.z() - pickup.z());
        return Math.round(d / EXPRESS_SPEED + EXPRESS_MARGIN);
    }

    public static List<MissionDef> story(Locations l) {
        List<Location> givers = l.missionGivers();
        Location pickup = l.missionPoints().get(0);
        Location delivery = l.missionPoints().get(1);
        return List.of(
                new MissionDef(
                        "express",
                        "Colis express",
                        "Un client pressé. Récupère le colis en voiture et livre-le avant la fin du chrono.",
                        800,
                        pos(givers.get(0)),
                        List.of(
                                new Step.Goto("Récupère le colis (en véhicule)", pos(pickup), 5, true, false),
                                new Step.Deliver(
                                        "Livre le colis au client",
                                        pos(delivery),
                                        6,
                                        expressTimeLimit(pickup, delivery),
                                        null))),
                new MissionDef(
                        "chase",
                        "La fuite",
                        "Un mauvais payeur vient de filer en sportive. Rattrape-le et mets fin à sa course.",
                        1500,
                        pos(givers.get(1)),
                        List.of(new Step.Destroy("Arrête la voiture de la cible", "target"))),
                new MissionDef(
                        "port",
                        "Contrat au port",
                        "Un trafiquant tient un entrepôt sur les docks. Élimine-le, puis disparais.",
                        2500,
                        pos(givers.get(2)),
                        List.of(
                                Step.Goto.anyway("Rends-toi à l'entrepôt du port", pos(l.warehouseDoor()), 30),
                                new Step.Eliminate("Élimine le trafiquant", List.of("boss")),
                                new Step.Escape("Sème la police"))),
                new MissionDef(
                        "special",
                        "Commande spéciale",
                        "Un collectionneur veut une sportive dorée garée en ville. Vole-la, sème les flics et ramène-la au garage "
                                + "sans trop l'abîmer.",
                        3000,
                        pos(givers.get(3)),
                        List.of(
                                new Step.EnterVehicle("Vole la sportive dorée", "special"),
                                new Step.Escape("Sème la police"),
                                new Step.Deliver("Ramène la voiture au garage", pos(l.garage()), 6, null, "special"))));
    }
}
