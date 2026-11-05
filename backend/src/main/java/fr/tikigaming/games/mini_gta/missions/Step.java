package fr.tikigaming.games.mini_gta.missions;

import java.util.List;

/** Étapes déclaratives d'une mission. */
public sealed interface Step {
    String text();

    record Goto(String text, Pos pos, double radius, boolean inVehicle, boolean onFoot) implements Step {
        /** Se rendre au repère, à pied ou en véhicule. */
        public static Goto anyway(String text, Pos pos, double radius) {
            return new Goto(text, pos, radius, false, false);
        }
    }

    /**
     * @param timeLimit limite en secondes, ou {@code null}
     * @param requireTag étiquette du véhicule à livrer, ou {@code null}
     */
    record Deliver(String text, Pos pos, double radius, Double timeLimit, String requireTag) implements Step {}

    record EnterVehicle(String text, String tag) implements Step {}

    record Eliminate(String text, List<String> tags) implements Step {
        public Eliminate {
            tags = List.copyOf(tags);
        }
    }

    record Destroy(String text, String tag) implements Step {}

    record Escape(String text) implements Step {}

    record Wait(String text, double seconds) implements Step {}
}
