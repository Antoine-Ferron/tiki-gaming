// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { input } from './input'

let canvas: HTMLCanvasElement
let detach: () => void

const lock = (el: Element | null) => {
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => el })
  document.dispatchEvent(new Event('pointerlockchange'))
}

beforeEach(() => {
  canvas = document.createElement('canvas')
  detach = input.attach(canvas)
})

afterEach(() => {
  lock(null)
  window.dispatchEvent(new Event('blur'))
  input.consumeMouse()
  input.consumeWheel()
  input.lockOnClick = false
  detach()
})

describe('clavier et souris', () => {
  test('un second attach est sans effet tant que le premier est actif', () => {
    const other = input.attach(document.createElement('canvas'))
    other()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))

    expect(input.isDown('KeyW')).toBe(true)
  })

  test.each([
    ['avancer', ['KeyW'], 1],
    ['reculer', ['KeyS'], -1],
    ['les deux à la fois', ['KeyW', 'KeyS'], 0],
    ['aucune touche', [], 0],
  ])('axe : %s', (_, keys, expected) => {
    for (const code of keys) window.dispatchEvent(new KeyboardEvent('keydown', { code }))

    expect(input.axis('KeyS', 'KeyW')).toBe(expected)
  })

  test('relâcher une touche ou perdre le focus vide l’état', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }))
    expect(input.isDown('KeyA')).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }))
    canvas.dispatchEvent(new MouseEvent('mousedown', { buttons: 2 }))
    window.dispatchEvent(new Event('blur'))

    expect(input.isDown('KeyD')).toBe(false)
    expect(input.buttons).toBe(0)
  })

  test('la souris ne tourne la caméra que pointeur verrouillé', () => {
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 5, movementY: 3 } as MouseEventInit))
    expect(input.consumeMouse()).toEqual({ dx: 0, dy: 0 })

    lock(canvas)
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 5, movementY: 3 } as MouseEventInit))
    window.dispatchEvent(new MouseEvent('mousemove', { movementX: 2, movementY: -1 } as MouseEventInit))

    expect(input.pointerLocked).toBe(true)
    expect(input.consumeMouse()).toEqual({ dx: 7, dy: 2 })
    expect(input.consumeMouse()).toEqual({ dx: 0, dy: 0 })
  })

  test('la molette ne compte que pointeur verrouillé', () => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }))
    expect(input.consumeWheel()).toBe(0)

    lock(canvas)
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }))
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -40 }))

    expect(input.consumeWheel()).toBe(0)
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 3 }))
    expect(input.consumeWheel()).toBe(1)
  })

  test('boutons de souris et verrouillage au clic', () => {
    let requested = 0
    canvas.requestPointerLock = (() => {
      requested++
    }) as unknown as HTMLCanvasElement['requestPointerLock']

    canvas.dispatchEvent(new MouseEvent('mousedown', { buttons: 1 }))
    expect(input.buttons).toBe(1)
    expect(requested).toBe(0)

    input.lockOnClick = true
    canvas.dispatchEvent(new MouseEvent('mousedown', { buttons: 3 }))
    window.dispatchEvent(new MouseEvent('mouseup', { buttons: 0 }))

    expect(requested).toBe(1)
    expect(input.buttons).toBe(0)
  })

  test('le clic droit n’ouvre pas le menu contextuel', () => {
    const e = new MouseEvent('contextmenu', { cancelable: true })

    canvas.dispatchEvent(e)

    expect(e.defaultPrevented).toBe(true)
  })

  test('en jeu, Tab et Espace ne font ni défiler ni changer le focus', () => {
    const free = new KeyboardEvent('keydown', { code: 'Space', cancelable: true })
    window.dispatchEvent(free)
    expect(free.defaultPrevented).toBe(false)

    lock(canvas)
    const tab = new KeyboardEvent('keydown', { code: 'Tab', cancelable: true })
    const letter = new KeyboardEvent('keydown', { code: 'KeyQ', cancelable: true })
    window.dispatchEvent(tab)
    window.dispatchEvent(letter)

    expect(tab.defaultPrevented).toBe(true)
    expect(letter.defaultPrevented).toBe(false)
  })

  test.each([
    ['KeyW', 'W'],
    ['Digit3', '3'],
    ['Space', 'Espace'],
    ['ShiftLeft', 'Maj'],
    ['ControlLeft', 'Ctrl'],
    ['Escape', 'Échap'],
    ['F5', 'F5'],
  ])('libellé de %s : %s', (code, label) => {
    expect(input.label(code)).toBe(label)
  })
})
