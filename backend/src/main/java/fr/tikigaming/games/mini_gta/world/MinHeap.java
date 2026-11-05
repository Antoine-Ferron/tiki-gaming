package fr.tikigaming.games.mini_gta.world;

import java.util.Arrays;
import java.util.NoSuchElementException;

/** Tas binaire minimal d'identifiants entiers ordonnés par une clé réelle (file de priorité de l'A*). */
final class MinHeap {
    private int[] ids = new int[16];
    private double[] keys = new double[16];
    private int size;

    int size() {
        return size;
    }

    void push(int id, double key) {
        if (size == ids.length) {
            ids = Arrays.copyOf(ids, size * 2);
            keys = Arrays.copyOf(keys, size * 2);
        }
        ids[size] = id;
        keys[size] = key;
        int i = size++;
        while (i > 0) {
            int p = (i - 1) >> 1;
            if (keys[p] <= keys[i]) break;
            swap(i, p);
            i = p;
        }
    }

    int pop() {
        if (size == 0) throw new NoSuchElementException("tas vide");
        int top = ids[0];
        size--;
        ids[0] = ids[size];
        keys[0] = keys[size];
        int i = 0;
        for (; ; ) {
            int l = i * 2 + 1;
            int r = l + 1;
            int m = i;
            if (l < size && keys[l] < keys[m]) m = l;
            if (r < size && keys[r] < keys[m]) m = r;
            if (m == i) break;
            swap(i, m);
            i = m;
        }
        return top;
    }

    private void swap(int a, int b) {
        int id = ids[a];
        ids[a] = ids[b];
        ids[b] = id;
        double k = keys[a];
        keys[a] = keys[b];
        keys[b] = k;
    }
}
