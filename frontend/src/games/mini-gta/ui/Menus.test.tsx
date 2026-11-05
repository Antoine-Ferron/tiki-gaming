// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { newSave } from '../domain/save'
import { useGameStore } from '../state/gameStore'
import { useHudStore } from '../state/hudStore'
import { DEFAULT_SETTINGS, useSettingsStore } from '../state/settingsStore'
import { useUiStore } from '../state/uiStore'
import {
  addWeapon,
  createInventory,
  loadWeaponDefs,
  slotOf,
  WEAPONS,
  type WeaponDef,
  type WeaponId,
} from '../systems/weapons'
import weapons from '../systems/fixtures/weapons.json'
import { Menus } from './Menus'

// Les textures du rendu sont dessinées au canvas dès l'import des modules : doublure installée avant tout import.
vi.hoisted(() => {
  const proxy: unknown = new Proxy(function () {}, {
    get: (_, key) => (key === 'data' ? new Uint8ClampedArray(4) : key === Symbol.toPrimitive ? () => 0 : proxy),
    set: () => true,
    apply: () => proxy,
    construct: () => proxy as object,
  })
  HTMLCanvasElement.prototype.getContext = (() => proxy) as unknown as HTMLCanvasElement['getContext']
})

// Le jeu en cours est remplacé par une doublure, et l'API par la fausse API aux règles du backend.
let currentGame: unknown = null
vi.mock('../game/current', () => ({ getGame: () => currentGame }))
vi.mock('../net/api', () => import('../game/testing/fakeApi'))
// L'image de la carte est du rendu pur (canvas).
vi.mock('./mapImage', () => ({ mapImage: () => ({}), MAP_PX: 1024, toMap: (x: number, z: number) => ({ x, y: z }) }))

beforeAll(() => {
  loadWeaponDefs(weapons as unknown as Record<WeaponId, WeaponDef>)
})

beforeEach(() => {
  currentGame = null
  useUiStore.getState().reset()
  useGameStore.getState().load(newSave())
  useSettingsStore.getState().set(DEFAULT_SETTINGS)
})

afterEach(cleanup)

function inGame(menu: Parameters<ReturnType<typeof useUiStore.getState>['setMenu']>[0]) {
  useUiStore.setState({ started: true, loading: null, menu })
  return render(<Menus />)
}

describe('écran de démarrage', () => {
  test('pendant le chargement : barre de progression et étape en cours', () => {
    useUiStore.setState({ loading: { text: 'Chargement de la ville…', progress: 0.4 } })

    render(<Menus />)

    expect(screen.getByRole('status').textContent).toContain('Chargement de la ville…')
    expect(screen.queryByRole('button', { name: 'Entrer en ville' })).toBeNull()
  })

  test('ville chargée : entrer en ville démarre la partie', () => {
    useUiStore.setState({ loading: null })
    render(<Menus />)

    fireEvent.click(screen.getByRole('button', { name: 'Entrer en ville' }))

    expect(useUiStore.getState()).toMatchObject({ started: true, menu: null })
  })

  test('affiche et masque les commandes', () => {
    useUiStore.setState({ loading: null })
    render(<Menus />)

    fireEvent.click(screen.getByRole('button', { name: 'Voir les commandes' }))
    expect(screen.getByText('Se déplacer / conduire')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Masquer les commandes' }))
    expect(screen.queryByText('Se déplacer / conduire')).toBeNull()
  })

  test('échec du chargement : le message s’affiche et Quitter rend la main', () => {
    const exit = vi.fn()
    useUiStore.setState({ loading: null, loadError: 'Le serveur est injoignable.', exit })
    render(<Menus />)

    expect(screen.getByRole('alert').textContent).toBe('Le serveur est injoignable.')
    fireEvent.click(screen.getByRole('button', { name: 'Quitter' }))

    expect(exit).toHaveBeenCalledOnce()
  })
})

describe('pause', () => {
  test('affiche les missions terminées et reprend la partie', () => {
    useGameStore.getState().load({ ...newSave(), completedMissions: ['express', 'chase'] })
    inGame('pause')

    expect(screen.getByText('Missions terminées : 2 / 4')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }))

    expect(useUiStore.getState().menu).toBeNull()
  })

  test('onglets Réglages et Commandes', () => {
    inGame('pause')

    fireEvent.click(screen.getByRole('button', { name: 'Réglages' }))
    expect(screen.getByRole('button', { name: 'Réglages' }).className).toContain('mini-gta-active')
    expect(screen.getByText('Ombres')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Commandes' }))
    expect(screen.getByText('Sauvegarde rapide')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Jeu' }))
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeTruthy()
  })

  test('Quitter sans partie chargée rend la main tout de suite', async () => {
    const exit = vi.fn()
    useUiStore.setState({ exit })
    inGame('pause')

    fireEvent.click(screen.getByRole('button', { name: 'Quitter' }))

    await waitFor(() => expect(exit).toHaveBeenCalledOnce())
  })

  test('Quitter sauvegarde la partie (armure et armes) avant de rendre la main', async () => {
    const exit = vi.fn()
    const inventory = createInventory()
    const events = { emit: vi.fn() }
    currentGame = { player: { actor: { armor: 42.4 }, inventory }, events }
    useUiStore.setState({ exit })
    inGame('pause')

    fireEvent.click(screen.getByRole('button', { name: 'Quitter' }))

    await waitFor(() => expect(exit).toHaveBeenCalledOnce())
    expect(useGameStore.getState().armor).toBe(42)
    expect(events.emit).toHaveBeenCalledWith('notify', { text: 'Partie sauvegardée', kind: 'success' })
  })

  test('Nouvelle partie demande confirmation, puis efface la progression et quitte', async () => {
    const exit = vi.fn()
    useGameStore.getState().load({ ...newSave(), money: 9000, completedMissions: ['express'] })
    useUiStore.setState({ exit })
    inGame('pause')

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))
    expect(screen.getByRole('alert').textContent).toContain('Effacer ta progression')
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(useGameStore.getState().money).toBe(9000)

    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Oui, recommencer' }))

    await waitFor(() => expect(exit).toHaveBeenCalledOnce())
    expect(useGameStore.getState()).toMatchObject({ money: 500, completedMissions: [] })
  })

  test('ouvrir un menu libère le pointeur', () => {
    const exitPointerLock = vi.fn()
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => document.body })
    document.exitPointerLock = exitPointerLock

    inGame('pause')

    expect(exitPointerLock).toHaveBeenCalled()
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null })
  })
})

describe('réglages', () => {
  function openSettings() {
    inGame('pause')
    fireEvent.click(screen.getByRole('button', { name: 'Réglages' }))
  }

  test('chaque réglage modifie les préférences de l’appareil', () => {
    openSettings()

    fireEvent.change(screen.getByLabelText('Ombres'), { target: { value: 'off' } })
    fireEvent.click(screen.getByLabelText(/Post-traitement/))
    fireEvent.change(screen.getByLabelText(/Résolution/), { target: { value: '0.75' } })
    fireEvent.change(screen.getByLabelText(/Distance d’affichage/), { target: { value: '400' } })
    fireEvent.change(screen.getByLabelText(/Densité du trafic/), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/Densité des piétons/), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/Sensibilité souris/), { target: { value: '2' } })
    fireEvent.click(screen.getByLabelText(/Inverser l’axe Y/))

    expect(useSettingsStore.getState()).toMatchObject({
      shadows: 'off',
      postfx: false,
      resolution: 0.75,
      viewDistance: 400,
      trafficDensity: 10,
      pedestrianDensity: 5,
      sensitivity: 2,
      invertY: true,
    })
    expect(screen.getByText(/Distance d’affichage \(400 m\)/)).toBeTruthy()
  })

  test('Valeurs par défaut restaure tout', () => {
    useSettingsStore.getState().set({ shadows: 'low', trafficDensity: 3 })
    openSettings()

    fireEvent.click(screen.getByRole('button', { name: 'Valeurs par défaut' }))

    expect(useSettingsStore.getState()).toMatchObject(DEFAULT_SETTINGS)
  })
})

describe('armurerie', () => {
  function openShop(money: number, armor = 0, owned: WeaponId[] = []) {
    const inventory = createInventory()
    for (const id of owned) if (!slotOf(inventory, id)) addWeapon(inventory, id, WEAPONS[id].magazine * 5)
    const game = { player: { inventory, actor: { armor } } }
    currentGame = game
    useGameStore.getState().load({ ...newSave(), money })
    inGame('shop')
    return game
  }
  const row = (label: string) => screen.getByText(label).closest('tr')!

  test('sans partie chargée, rien ne s’affiche', () => {
    const { container } = inGame('shop')

    expect(container.textContent).toBe('')
  })

  test('affiche l’argent et grise ce qui est trop cher', () => {
    openShop(500)

    expect(screen.getByText(/^500\s\$$/)).toBeTruthy()
    expect((row('Batte').querySelector('button') as HTMLButtonElement).disabled).toBe(false)
    expect((row('Sniper').querySelector('button') as HTMLButtonElement).disabled).toBe(true)
  })

  test('acheter une arme débite l’argent et l’ajoute à l’inventaire', async () => {
    const game = openShop(1500)

    fireEvent.click(row('Fusil à pompe').querySelector('button')!)

    await waitFor(() => expect(useGameStore.getState().money).toBe(300))
    expect(slotOf(game.player.inventory, 'shotgun')).toBeTruthy()
    await waitFor(() => expect(row('Fusil à pompe').textContent).toMatch(/munitions/))
  })

  test('arme possédée : munitions à acheter ; arme blanche : marquée possédée', async () => {
    const game = openShop(500, 0, ['pistol'])
    expect(row('Pistolet').textContent).toContain('60 munitions')
    fireEvent.click(row('Batte').querySelector('button')!)
    await waitFor(() => expect(row('Batte').textContent).toContain('Possédé'))
    expect(row('Batte').querySelector('button')).toBeNull()

    fireEvent.click(row('Pistolet').querySelector('button')!)

    await waitFor(() => expect(useGameStore.getState().money).toBe(500 - 100 - 60))
    expect(slotOf(game.player.inventory, 'pistol')!.ammo).toBeGreaterThan(48)
  })

  test('le gilet remplit l’armure, et n’est plus achetable une fois plein', async () => {
    const game = openShop(1000)

    fireEvent.click(row('Gilet pare-balles').querySelector('button')!)

    await waitFor(() => expect(game.player.actor.armor).toBe(100))
    await waitFor(() =>
      expect((row('Gilet pare-balles').querySelector('button') as HTMLButtonElement).disabled).toBe(true),
    )
  })

  test('achat refusé par le serveur : rien ne change', async () => {
    const game = openShop(1500)
    const { calls } = await import('../game/testing/fakeApi')
    const before = calls.length
    // Le solde change juste avant le clic (bouton encore actif) : le serveur ne voit que 100 $ et refuse.
    useGameStore.setState({ money: 100 })

    fireEvent.click(row('Fusil à pompe').querySelector('button')!)

    await waitFor(() => expect(calls.length).toBe(before + 1))
    expect(useGameStore.getState().money).toBe(100)
    expect(slotOf(game.player.inventory, 'shotgun')).toBeFalsy()
  })

  test('serveur injoignable : le message est notifié au joueur', async () => {
    const { failNext } = await import('../game/testing/fakeApi')
    openShop(500)
    failNext(new Error('Le serveur est injoignable.'))

    fireEvent.click(row('Pistolet').querySelector('button')!)

    await waitFor(() =>
      expect(useUiStore.getState().notifications.map((n) => n.text)).toContain('Le serveur est injoignable.'),
    )
  })

  test('Fermer reprend la partie', () => {
    openShop(500)

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(useUiStore.getState().menu).toBeNull()
  })
})

describe('carte', () => {
  function openMap() {
    currentGame = {
      city: {
        locations: {
          safehouseDoor: { x: 0, z: 0 },
          gunshopDoor: { x: 10, z: 0 },
          hospital: { x: 20, z: 0 },
          policeStation: { x: 30, z: 0 },
          heliSpawn: { x: 40, z: 0 },
        },
      },
      missions: { available: () => [{ giver: { x: 5, z: 5 }, title: 'Colis express' }] },
      player: { position: { x: 1, z: 1 } },
    }
    return inGame('map')
  }

  test('un clic place un repère GPS, un clic droit l’efface', () => {
    const { container } = openMap()
    const canvas = container.querySelector('canvas')!
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect

    fireEvent.click(canvas, { clientX: 50, clientY: 25 })
    expect(useUiStore.getState().waypoint).toEqual({ x: 0, z: -512 })

    fireEvent.contextMenu(canvas)
    expect(useUiStore.getState().waypoint).toBeNull()
  })

  test('le bouton « Fermer la carte » la ferme', () => {
    useUiStore.setState({ waypoint: { x: 3, z: 4 } })
    openMap()

    fireEvent.click(screen.getByRole('button', { name: 'Fermer la carte' }))

    expect(useUiStore.getState().menu).toBeNull()
  })
})

describe('roue des armes', () => {
  test('pointer une arme possédée la sélectionne, et elle est équipée à la fermeture', async () => {
    const select = vi.fn()
    const game = { ui: { cursor: { x: 0, y: 0 } }, combat: { select } }
    currentGame = game
    useHudStore.setState({ owned: ['fists', 'pistol'], weapon: 'fists' })
    const { container, unmount } = inGame('wheel')
    expect(container.querySelector('.mini-gta-center')?.textContent).toBe('Poings')

    // Le pistolet est la 3ᵉ case sur 7 : on pousse le curseur bien au-delà du rayon de la roue.
    const a = (2 / 7) * Math.PI * 2 - Math.PI / 2
    game.ui.cursor.x = Math.cos(a) * 400
    game.ui.cursor.y = Math.sin(a) * 400

    await waitFor(() => expect(container.querySelector('.mini-gta-center')?.textContent).toBe('Pistolet'))
    expect(Math.hypot(game.ui.cursor.x, game.ui.cursor.y)).toBeCloseTo(150)
    expect(container.querySelectorAll('.mini-gta-slot.mini-gta-empty')).toHaveLength(5)
    unmount()

    expect(select).toHaveBeenCalledWith('pistol')
  })

  test('une arme non possédée ne peut pas être choisie', async () => {
    const select = vi.fn()
    const game = { ui: { cursor: { x: 0, y: 0 } }, combat: { select } }
    currentGame = game
    useHudStore.setState({ owned: ['fists'], weapon: 'fists' })
    const { container, unmount } = inGame('wheel')

    const a = (5 / 7) * Math.PI * 2 - Math.PI / 2
    game.ui.cursor.x = Math.cos(a) * 100
    game.ui.cursor.y = Math.sin(a) * 100
    await new Promise((r) => setTimeout(r, 50))

    expect(container.querySelector('.mini-gta-center')?.textContent).toBe('Poings')
    unmount()
    expect(select).toHaveBeenCalledWith('fists')
  })

  test('sans partie chargée, la roue s’affiche sans rien équiper', () => {
    useHudStore.setState({ owned: ['fists'], weapon: 'fists' })

    const { container } = inGame('wheel')

    expect(container.querySelector('.mini-gta-center')?.textContent).toBe('Poings')
  })
})

test('en jeu sans menu ouvert, rien ne s’affiche', () => {
  const { container } = inGame(null)

  expect(container.textContent).toBe('')
})
