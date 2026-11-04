// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FullscreenButton } from './FullscreenButton'

let fullscreen: Element | null = null
Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen })

function setup() {
  const target = document.createElement('div')
  target.requestFullscreen = vi.fn(async () => {
    fullscreen = target
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  document.exitFullscreen = vi.fn(async () => {
    fullscreen = null
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  render(<FullscreenButton target={{ current: target }} />)
  return target
}

afterEach(() => {
  cleanup()
  fullscreen = null
})

describe('bouton plein écran', () => {
  test('met la zone de jeu en plein écran', async () => {
    const target = setup()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Plein écran' })))

    expect(target.requestFullscreen).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Quitter le plein écran' })).toBeTruthy()
  })

  test('en plein écran, le bouton en sort', async () => {
    setup()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Plein écran' })))

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Quitter le plein écran' })))

    expect(document.exitFullscreen).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeTruthy()
  })

  test('sortir avec Échap remet le libellé', async () => {
    setup()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Plein écran' })))

    act(() => {
      fullscreen = null
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeTruthy()
  })

  test('plein écran refusé par le navigateur : le jeu continue dans la page', async () => {
    const target = setup()
    target.requestFullscreen = vi.fn(async () => {
      throw new Error('refusé')
    })

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Plein écran' })))

    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeTruthy()
  })
})
