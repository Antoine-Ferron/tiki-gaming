// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useUiStore } from '../state/uiStore'
import { Chat } from './Chat'

// /aide et les messages ordinaires n'ont besoin d'aucune partie : un objet vide suffit.
vi.mock('../game/current', () => ({ getGame: () => ({}) }))

beforeEach(() => {
  useUiStore.getState().reset()
  useUiStore.setState({ chatHistory: [] })
})
afterEach(cleanup)

const open = () => act(() => useUiStore.getState().setMenu('chat'))
const input = () => screen.getByRole('textbox', { name: 'Chat et commandes' })

describe('chat', () => {
  test('fermé, il n’affiche pas de saisie', () => {
    render(<Chat />)

    expect(screen.queryByRole('textbox')).toBeNull()
  })

  test('ouvert, la saisie a le focus ; Entrée exécute la commande et ferme le chat', () => {
    render(<Chat />)
    open()

    expect(document.activeElement).toBe(input())
    fireEvent.change(input(), { target: { value: '/aide' } })
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(useUiStore.getState().menu).toBeNull()
    expect(screen.getByText('> /aide')).toBeTruthy()
    expect(screen.getByText(/\/summon <véhicule>/)).toBeTruthy()
  })

  test('une commande inconnue affiche une erreur', () => {
    render(<Chat />)
    open()

    fireEvent.change(input(), { target: { value: '/zzz' } })
    fireEvent.keyDown(input(), { key: 'Enter' })

    expect(screen.getByText(/Commande inconnue : \/zzz/).className).toContain('mini-gta-chat-error')
  })

  test('Échap ferme sans rien exécuter', () => {
    render(<Chat />)
    open()

    fireEvent.change(input(), { target: { value: '/aide' } })
    fireEvent.keyDown(input(), { key: 'Escape' })

    expect(useUiStore.getState().menu).toBeNull()
    expect(useUiStore.getState().chat).toHaveLength(0)
  })

  test('Tab complète, ↑ et ↓ rappellent les lignes précédentes', () => {
    useUiStore.setState({ chatHistory: ['/heure 12', '/tp planque'] })
    render(<Chat />)
    open()

    fireEvent.change(input(), { target: { value: '/sum' } })
    fireEvent.keyDown(input(), { key: 'Tab' })
    expect((input() as HTMLInputElement).value).toBe('/summon ')

    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    expect((input() as HTMLInputElement).value).toBe('/tp planque')
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    expect((input() as HTMLInputElement).value).toBe('/heure 12')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect((input() as HTMLInputElement).value).toBe('/tp planque')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect((input() as HTMLInputElement).value).toBe('')
  })

  test('les touches tapées ne remontent pas jusqu’au jeu', () => {
    const seen: string[] = []
    const listener = (e: KeyboardEvent) => seen.push(e.code)
    window.addEventListener('keydown', listener)
    render(<Chat />)
    open()

    fireEvent.keyDown(input(), { key: 'w', code: 'KeyW' })
    window.removeEventListener('keydown', listener)

    expect(seen).toEqual([])
  })

  test('chat fermé : les lignes récentes restent visibles puis disparaissent', () => {
    vi.useFakeTimers()
    const t0 = performance.now()
    vi.spyOn(performance, 'now').mockReturnValue(t0)
    useUiStore.getState().addChat('Avion invoqué devant toi.', 'ok')
    render(<Chat />)
    expect(screen.getByText('Avion invoqué devant toi.')).toBeTruthy()

    vi.spyOn(performance, 'now').mockReturnValue(t0 + 8000)
    act(() => vi.advanceTimersByTime(600))

    expect(screen.queryByText('Avion invoqué devant toi.')).toBeNull()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
})
