package fr.tikigaming.games.sdv_civilisation;

/** Implémentation de production : heure du système. */
public final class SystemClock implements Clock {

    @Override
    public long now() {
        return System.currentTimeMillis();
    }
}
