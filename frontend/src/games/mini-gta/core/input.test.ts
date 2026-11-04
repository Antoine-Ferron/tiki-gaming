// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { input } from './input'

const press = (code: string) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code }))
}

describe('appuis de touches', () => {
  let detach: () => void
  beforeEach(() => {
    detach = input.attach(document.createElement('canvas'))
  })
  afterEach(() => {
    input.endFrame()
    input.endTick()
    detach()
  })

  test('un appui bref survit à une frame sans pas de simulation', () => {
    press('KeyF')

    input.endFrame()

    expect(input.wasPressed('KeyF')).toBe(true)
  })

  test('la simulation ne voit l’appui qu’à un seul pas', () => {
    press('KeyF')

    expect(input.wasPressed('KeyF')).toBe(true)
    input.endTick()
    expect(input.wasPressed('KeyF')).toBe(false)
  })

  test('l’interface ne voit l’appui qu’à une seule frame, indépendamment des pas', () => {
    press('KeyM')

    input.endTick()
    expect(input.wasPressedThisFrame('KeyM')).toBe(true)
    input.endFrame()
    expect(input.wasPressedThisFrame('KeyM')).toBe(false)
  })

  test('une touche maintenue n’est pas un nouvel appui', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    input.endTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))

    expect(input.wasPressed('KeyW')).toBe(false)
    expect(input.isDown('KeyW')).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
  })
})
