package fr.tikigaming.games.sdv_civilisation;

/** Fake : horloge qui n'avance que quand le test le demande (pas d'attente réelle). */
class FakeClock implements Clock {

    private long current;

    FakeClock(long start) {
        this.current = start;
    }

    @Override
    public long now() {
        return current;
    }

    void advance(long millis) {
        current += millis;
    }
}
