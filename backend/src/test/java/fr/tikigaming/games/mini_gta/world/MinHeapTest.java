package fr.tikigaming.games.mini_gta.world;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;

class MinHeapTest {

    @Test
    void depileParCleCroissante() {
        MinHeap heap = new MinHeap();
        double[] keys = {5, 1, 4, 2, 3, 0.5, 9, 7};
        for (int i = 0; i < keys.length; i++) heap.push(i, keys[i]);
        List<Integer> order = new ArrayList<>();
        while (heap.size() > 0) order.add(heap.pop());
        assertEquals(List.of(5, 1, 3, 4, 2, 0, 7, 6), order);
    }

    @Test
    void accepteLesDoublons() {
        MinHeap heap = new MinHeap();
        heap.push(7, 1);
        heap.push(7, 1);
        assertEquals(2, heap.size());
        assertEquals(7, heap.pop());
        assertEquals(7, heap.pop());
        assertEquals(0, heap.size());
    }

    @Test
    void unSeulElement() {
        MinHeap heap = new MinHeap();
        heap.push(3, 42);
        assertEquals(3, heap.pop());
    }

    @Test
    void depilerUnTasVideEstUneErreur() {
        assertThrows(NoSuchElementException.class, () -> new MinHeap().pop());
    }

    @Test
    void grandirAuDelaDeLaCapaciteInitialeConserveLOrdre() {
        MinHeap heap = new MinHeap();
        for (int i = 0; i < 100; i++) heap.push(i, (i * 37) % 100);
        double last = -1;
        while (heap.size() > 0) {
            int id = heap.pop();
            double key = (id * 37) % 100;
            org.junit.jupiter.api.Assertions.assertTrue(key >= last);
            last = key;
        }
    }

    @Test
    void lesClesEgalesSortentToutes() {
        MinHeap heap = new MinHeap();
        for (int i = 0; i < 5; i++) heap.push(i, 1);
        heap.push(9, 0);
        assertEquals(9, heap.pop());
        java.util.Set<Integer> rest = new java.util.HashSet<>();
        while (heap.size() > 0) rest.add(heap.pop());
        assertEquals(java.util.Set.of(0, 1, 2, 3, 4), rest);
    }
}
