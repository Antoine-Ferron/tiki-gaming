package fr.tikigaming.games.sdv_civilisation;

/** Minuteur d'un tour, voir docs/games/sdv-civilisation/regles.md#temps-de-tour */
public final class TurnTimer {

    public static final long DURATION_MILLIS = 60_000L;
    public static final long WARNING_MILLIS = 10_000L;

    private final Clock clock;
    private final long deadline;

    private TurnTimer(Clock clock, long duration) {
        this.clock = clock;
        this.deadline = clock.now() + duration;
    }

    public static TurnTimer start(Clock clock) {
        return start(clock, DURATION_MILLIS);
    }

    public static TurnTimer start(Clock clock, long duration) {
        return new TurnTimer(clock, duration);
    }

    public long remainingMillis() {
        return Math.max(0, deadline - clock.now());
    }

    public TurnPhase phase() {
        long remaining = remainingMillis();
        if (remaining == 0) {
            return TurnPhase.EXPIRED;
        }
        if (remaining <= WARNING_MILLIS) {
            return TurnPhase.WARNING;
        }
        return TurnPhase.RUNNING;
    }
}
