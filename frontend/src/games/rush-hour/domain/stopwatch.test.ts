import { describe, expect, test } from 'vitest'
import { type Clock, Stopwatch } from './stopwatch'

/** Doublure d'horloge : le temps n'avance que quand le test le décide (pas de Date.now, pas de sleep). */
class ManualClock implements Clock {
  constructor(private ms = 0) {}
  now() {
    return this.ms
  }
  advance(ms: number) {
    this.ms += ms
  }
}

describe('Stopwatch', () => {
  test('mesure le temps écoulé depuis le début de la partie', () => {
    // Arrange
    const clock = new ManualClock(1_000)
    const stopwatch = new Stopwatch(clock)

    // Act
    clock.advance(3_000)

    // Assert
    expect(stopwatch.elapsedMs).toBe(3_000)
  })

  test('s’arrête à la victoire : le temps qui passe ensuite ne compte plus', () => {
    // Arrange
    const clock = new ManualClock(1_000)
    const stopwatch = new Stopwatch(clock)
    clock.advance(5_000)
    clock.advance(2_500)

    // Act
    stopwatch.stop()
    clock.advance(60_000)

    // Assert
    expect(stopwatch.elapsedMs).toBe(7_500)
  })

  test('un second arrêt ne change pas le temps mesuré', () => {
    // Arrange
    const clock = new ManualClock()
    const stopwatch = new Stopwatch(clock)
    clock.advance(2_000)
    stopwatch.stop()
    clock.advance(4_000)

    // Act
    stopwatch.stop()

    // Assert
    expect(stopwatch.elapsedMs).toBe(2_000)
  })
})
