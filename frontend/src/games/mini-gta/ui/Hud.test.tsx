// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { newSave } from '../domain/save'
import { useGameStore } from '../state/gameStore'
import { useHudStore, type HudState } from '../state/hudStore'
import { useUiStore } from '../state/uiStore'
import { Hud } from './Hud'

// La minimap dessine dans un canvas (rendu pur) : sans intérêt ici.
vi.mock('./Minimap', () => ({ Minimap: () => null }))

const initialHud = useHudStore.getState()

function showHud(partial: Partial<HudState> = {}) {
  useHudStore.setState({ ...initialHud, ready: true, ...partial })
  return render(<Hud />)
}

beforeEach(() => {
  useUiStore.getState().reset()
  useUiStore.setState({ started: true, menu: null })
  useGameStore.getState().load({ ...newSave(), money: 1200 })
})

afterEach(() => {
  cleanup()
  useHudStore.setState(initialHud)
})

describe('HUD', () => {
  test('caché tant que la partie n’a pas commencé', () => {
    useUiStore.setState({ started: false })

    const { container } = showHud()

    expect(container.textContent).toBe('')
  })

  test('caché tant que le jeu n’a rien publié', () => {
    useHudStore.setState({ ...initialHud, ready: false })

    const { container } = render(<Hud />)

    expect(container.textContent).toBe('')
  })

  test('affiche l’heure, l’arme, l’argent et les étoiles', () => {
    const { container } = showHud({ hours: 9.5, weaponLabel: 'Poings', wanted: 2 })

    expect(screen.getByText('09:30')).toBeTruthy()
    expect(screen.getByText('Poings')).toBeTruthy()
    expect(screen.getByText(/1\s200\s\$/)).toBeTruthy()
    expect(container.querySelectorAll('.mini-gta-stars .mini-gta-on')).toHaveLength(2)
    expect(container.querySelectorAll('.mini-gta-stars .mini-gta-off')).toHaveLength(3)
    expect(container.querySelector('.mini-gta-flashing')).toBeNull()
  })

  test('étoiles qui clignotent quand la police a perdu ta trace', () => {
    const { container } = showHud({ wanted: 3, wantedFlashing: true })

    expect(container.querySelector('.mini-gta-stars.mini-gta-flashing')).not.toBeNull()
  })

  test.each([
    ['poings : pas de munitions', 'fists', null],
    ['batte : pas de munitions', 'bat', null],
    ['pistolet : chargeur / réserve', 'pistol', '12 / 48'],
    ['grenades : un seul compteur', 'grenade', '48'],
  ] as const)('%s', (_, weapon, shown) => {
    const { container } = showHud({ weapon, clip: 12, ammo: 48 })

    const ammo = container.querySelector('.mini-gta-ammo')
    if (shown === null) expect(ammo).toBeNull()
    else expect(ammo?.textContent).toBe(shown)
  })

  test('indique un rechargement en cours', () => {
    const { container } = showHud({ weapon: 'pistol', clip: 0, ammo: 24, reloading: true })

    expect(container.querySelector('.mini-gta-ammo')?.textContent).toContain('⟳')
  })

  test('à pied : pas de compteur de vitesse', () => {
    showHud({ inVehicle: false })

    expect(screen.queryByText('km/h')).toBeNull()
  })

  test('en voiture : vitesse et nom du véhicule, sans altitude au sol', () => {
    showHud({ inVehicle: true, speedKmh: 87, vehicleLabel: 'Berline', altitude: 0, vehicleHealth: 0.5 })

    expect(screen.getByText('87')).toBeTruthy()
    expect(screen.getByText('Berline')).toBeTruthy()
    expect(screen.queryByText(/Alt\./)).toBeNull()
  })

  test('en vol : l’altitude s’affiche', () => {
    showHud({ inVehicle: true, speedKmh: 140, vehicleLabel: 'Hélicoptère', altitude: 64 })

    expect(screen.getByText('Alt. 64 m')).toBeTruthy()
  })

  test('mission : objectif et minuteur, en alerte sous 15 s', () => {
    const { container, rerender } = showHud({
      mission: { title: 'Colis express', objective: 'Livre le colis', timer: 42.2 },
    })

    expect(screen.getByText('Livre le colis')).toBeTruthy()
    expect(screen.getByText('43 s')).toBeTruthy()
    expect(container.querySelector('.mini-gta-urgent')).toBeNull()

    act(() => useHudStore.setState({ mission: { title: 'Colis express', objective: 'Livre le colis', timer: 9.1 } }))
    rerender(<Hud />)

    expect(screen.getByText('10 s')).toBeTruthy()
    expect(container.querySelector('.mini-gta-urgent')).not.toBeNull()
  })

  test('mission sans chrono : pas de minuteur', () => {
    const { container } = showHud({ mission: { title: 'La fuite', objective: 'Rattrape-le', timer: null } })

    expect(screen.getByText('Rattrape-le')).toBeTruthy()
    expect(container.querySelector('.mini-gta-timer')).toBeNull()
  })

  test('invite d’interaction, masquée quand un menu est ouvert', () => {
    showHud({ prompt: 'E : armurerie' })
    expect(screen.getByText('E : armurerie')).toBeTruthy()

    act(() => useUiStore.setState({ menu: 'pause' }))

    expect(screen.queryByText('E : armurerie')).toBeNull()
  })

  test.each([
    ['visée au pistolet : réticule', 'pistol', '.mini-gta-crosshair', '.mini-gta-scope'],
    ['visée au sniper : lunette', 'sniper', '.mini-gta-scope', '.mini-gta-crosshair'],
  ] as const)('%s', (_, weapon, shown, hidden) => {
    const { container } = showHud({ aiming: true, weapon })

    expect(container.querySelector(shown)).not.toBeNull()
    expect(container.querySelector(hidden)).toBeNull()
  })

  test('notifications : bandeaux et grand titre (le dernier seulement)', () => {
    const { container } = showHud()

    act(() => {
      const ui = useUiStore.getState()
      ui.notify('Partie sauvegardée', 'success')
      ui.notify('MISSION RÉUSSIE', 'big')
      ui.notify('K.O.', 'big')
    })

    expect(screen.getByText('Partie sauvegardée').className).toContain('mini-gta-success')
    expect(screen.queryByText('MISSION RÉUSSIE')).toBeNull()
    expect(screen.getByText('K.O.').className).toContain('mini-gta-death')
    expect(container.querySelectorAll('.mini-gta-big-text')).toHaveLength(1)
  })

  test('un grand titre ordinaire n’est pas en rouge', () => {
    showHud()

    act(() => useUiStore.getState().notify('MISSION RÉUSSIE', 'big'))

    expect(screen.getByText('MISSION RÉUSSIE').className).not.toContain('mini-gta-death')
  })
})
