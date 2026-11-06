import { describe, expect, test } from 'vitest'
import { commandOf, inputOf } from './controls'

// EF-7.3 : flèches ou Q / D (A / D en QWERTY) pour diriger ; Échap ou P pour la pause.
describe('commandes clavier (EF-7.3)', () => {
  test.each([
    { touche: 'ArrowLeft', commande: 'left' },
    { touche: 'q', commande: 'left' },
    { touche: 'Q', commande: 'left' },
    { touche: 'a', commande: 'left' },
    { touche: 'ArrowRight', commande: 'right' },
    { touche: 'd', commande: 'right' },
    { touche: 'D', commande: 'right' },
    { touche: 'Escape', commande: 'pause' },
    { touche: 'p', commande: 'pause' },
    { touche: 'P', commande: 'pause' },
    { touche: 'ArrowUp', commande: null },
    { touche: 'z', commande: null },
    { touche: ' ', commande: null },
  ])('$touche → $commande', ({ touche, commande }) => {
    expect(commandOf(touche)).toBe(commande)
  })

  test.each([
    { appuyees: [], attendu: { left: false, right: false } },
    { appuyees: ['ArrowLeft'], attendu: { left: true, right: false } },
    { appuyees: ['d'], attendu: { left: false, right: true } },
    { appuyees: ['q', 'ArrowRight'], attendu: { left: true, right: true } },
    { appuyees: ['p', 'z'], attendu: { left: false, right: false } },
  ])('touches tenues $appuyees → $attendu', ({ appuyees, attendu }) => {
    expect(inputOf(new Set(appuyees))).toEqual(attendu)
  })
})
