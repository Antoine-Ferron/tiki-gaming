// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Realtime } from '../ports'
import type { GameContext } from '../types'
import { FakeRealtime, FakeRealtimeConnection } from '../testing/fakes'
import BatailleNavaleGame from './BatailleNavaleGame'
import { FLEET, GRID_SIZE, shipCoords, type Coord, type PlacedShip } from './logic'

// placeFleetRandomly est déjà exhaustivement testé en isolation dans logic.test.ts (placement déterministe).
// Ici, on le fixe pour ne tester que le câblage de l'interface sur un plateau connu.
const { placeFleetRandomly } = vi.hoisted(() => ({ placeFleetRandomly: vi.fn() }))

vi.mock('./logic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./logic')>()
  return { ...actual, placeFleetRandomly }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()
})

/** Flotte fixe : un navire par ligne (0 à 4), colonnes 0..size-1, horizontale. Laisse les lignes 5-9 vides. */
const FIXED_FLEET: PlacedShip[] = FLEET.map((ship, row) => ({
  ship,
  coords: shipCoords({ row, col: 0 }, ship.size, 'horizontal'),
}))

function buildCtx(overrides: Partial<GameContext> = {}): GameContext {
  return {
    gameSlug: 'bataille-navale',
    player: null,
    isGuest: true,
    submitScore: vi.fn().mockResolvedValue(true),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getMyBest: vi.fn().mockResolvedValue(null),
    loadSave: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clearSave: vi.fn().mockResolvedValue(undefined),
    realtime: new FakeRealtime(),
    ...overrides,
  }
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function cellName(c: Coord) {
  return `Case ${c.row + 1},${c.col + 1}`
}

/** Joue la phase de placement des deux joueurs (flotte fixe) jusqu'au début de la bataille. */
function startLocalGame(ctx = buildCtx()) {
  placeFleetRandomly.mockReturnValue(FIXED_FLEET)
  render(<BatailleNavaleGame ctx={ctx} />)
  click('Solo (même appareil)')
  click('Placer au hasard') // joueur 1
  click('Prêt')
  click('Je suis prêt') // passe au joueur 2
  click('Placer au hasard') // joueur 2
  click('Prêt')
  click('Je suis prêt') // passe pour commencer la bataille
  return ctx
}

describe('BatailleNavaleGame — menu', () => {
  test('propose le mode local ; masque le mode en ligne pour un invité', () => {
    render(<BatailleNavaleGame ctx={buildCtx({ isGuest: true })} />)

    expect(screen.getByRole('button', { name: 'Solo (même appareil)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'En ligne' })).toBeNull()
    expect(screen.getByText(/Connecte-toi pour jouer en ligne/)).toBeTruthy()
  })

  test('propose le mode en ligne à un joueur connecté', () => {
    render(<BatailleNavaleGame ctx={buildCtx({ isGuest: false, player: { id: 'u1', username: 'alice' } })} />)

    expect(screen.getByRole('button', { name: 'En ligne' })).toBeTruthy()
  })
})

describe('BatailleNavaleGame — mode local', () => {
  test('la bataille commence après le placement des deux flottes', () => {
    startLocalGame()

    expect(screen.getByText('Au tour du joueur 1')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Case / })).toHaveLength(GRID_SIZE * GRID_SIZE)
  })

  test('le panneau liste les cinq navires de chaque camp, intacts au début de la bataille', () => {
    startLocalGame()

    const mine = within(screen.getByText('Mes navires').closest('div')!)
    const theirs = within(screen.getByText('Navires adverses').closest('div')!)
    for (const ship of FLEET) {
      expect(mine.getByText(new RegExp(`^${ship.name}`))).toBeTruthy()
      expect(theirs.getByText(new RegExp(`^${ship.name}`))).toBeTruthy()
    }
    expect(screen.queryByText(/\(coulé\)/)).toBeNull()
    expect(screen.getByText('Tirs').nextElementSibling?.textContent).toBe('0')
  })

  test("un tir dans l'eau passe la main avec le message correspondant", async () => {
    startLocalGame()

    click(cellName({ row: 9, col: 9 })) // case vide dans la flotte fixe

    expect(await screen.findByText("À l'eau.")).toBeTruthy()
    expect(screen.getByText("Passe l'appareil")).toBeTruthy()

    click('Je suis prêt')
    expect(screen.getByText('Au tour du joueur 2')).toBeTruthy()
  })

  test('un tir qui touche sans couler annonce « Touché ! » et fait rejouer le même joueur', async () => {
    startLocalGame()

    click(cellName({ row: 0, col: 0 })) // Porte-avions (taille 5) : une seule case touchée

    expect(await screen.findByText(/^Touché !/)).toBeTruthy()
    // Pas de passation : toujours le joueur 1, la grille de tir est donc toujours affichée.
    expect(screen.getByText('Au tour du joueur 1')).toBeTruthy()
  })

  test('couler un navire annonce le navire coulé, sans passer la main (un tir qui touche fait rejouer)', async () => {
    startLocalGame()

    click(cellName({ row: 4, col: 0 })) // Torpilleur (taille 2), 1ère case
    expect(await screen.findByText(/^Touché !/)).toBeTruthy()

    click(cellName({ row: 4, col: 1 })) // Torpilleur, 2e et dernière case : coule, le joueur 1 garde la main
    expect(await screen.findByText(/^Torpilleur coulé !/)).toBeTruthy()
    expect(screen.getByText('Au tour du joueur 1')).toBeTruthy()

    const theirs = within(screen.getByText('Navires adverses').closest('div')!)
    expect(theirs.getByText(/^Torpilleur \(coulé\)/)).toBeTruthy()
    expect(theirs.getByText(/^Porte-avions/).closest('li')?.className).not.toContain('sunk')
  })

  test('au tour suivant du même joueur, ses tirs précédents restent marqués et désactivés', async () => {
    startLocalGame()
    click(cellName({ row: 0, col: 0 })) // touché, mais ne coule pas : le joueur 1 garde la main
    await screen.findByText(/^Touché !/)

    click(cellName({ row: 9, col: 9 })) // à l'eau : passe la main
    await screen.findByText("À l'eau.")
    click('Je suis prêt')

    click(cellName({ row: 8, col: 8 })) // joueur 2 : tir sans danger, passe la main à son tour
    await screen.findByText(/^(Touché !|À l'eau\.)/)
    click('Je suis prêt')

    expect(screen.getByText('Au tour du joueur 1')).toBeTruthy()
    const firstCell = screen.getByRole('button', { name: new RegExp(`^${cellName({ row: 0, col: 0 })}(,|$)`) })
    expect(firstCell).toBeDisabled()
    expect(firstCell.className).toContain('hit')
  })

  /** Le joueur 1 coule toute la flotte adverse (fixe) : chaque tir touche, donc il ne passe jamais la main. */
  async function sinkWholeOpponentFleet() {
    const player1Targets = FIXED_FLEET.flatMap((p) => p.coords) // 17 cases au total, toutes des touches
    for (const target of player1Targets) {
      await act(async () => {
        click(cellName(target))
      })
    }
  }

  test('couler toute la flotte adverse termine la partie, soumet le score et affiche le vainqueur', async () => {
    const ctx = startLocalGame()

    await sinkWholeOpponentFleet()

    expect(await screen.findByText('Le joueur 1 a gagné !')).toBeTruthy()
    expect(ctx.submitScore).toHaveBeenCalled()
    expect(ctx.getLeaderboard).toHaveBeenCalled()
  })

  test('invité : incite à se connecter pour apparaître au classement après la victoire', async () => {
    startLocalGame(buildCtx({ isGuest: true }))

    await sinkWholeOpponentFleet()

    expect(await screen.findByText(/Connecte-toi pour apparaître au classement/)).toBeTruthy()
  })
})

describe('BatailleNavaleGame — mode en ligne', () => {
  function buildOnlineCtx(connection: FakeRealtimeConnection) {
    const realtime: Realtime = {
      createRoom: vi.fn().mockResolvedValue(connection),
      joinRoom: vi.fn().mockResolvedValue(connection),
    }
    return buildCtx({ isGuest: false, player: { id: 'u1', username: 'alice' }, realtime })
  }

  test('une salle fraîchement créée est enregistrée pour pouvoir la retrouver après un rechargement', async () => {
    placeFleetRandomly.mockReturnValue(FIXED_FLEET)
    const connection = new FakeRealtimeConnection('ROOM-9', 1, 1)
    const ctx = buildOnlineCtx(connection)
    render(<BatailleNavaleGame ctx={ctx} />)

    click('En ligne')
    await act(async () => {
      click('Créer une partie')
    })

    expect(localStorage.getItem('tiki:bataille-navale:online-room')).toBe('ROOM-9')
  })

  test('propose de rejoindre ou de fermer une salle restée ouverte sur cet appareil', async () => {
    localStorage.setItem('tiki:bataille-navale:online-room', 'STALE-1')
    placeFleetRandomly.mockReturnValue(FIXED_FLEET)
    const connection = new FakeRealtimeConnection('STALE-1', 1, 1)
    const closeSpy = vi.spyOn(connection, 'close')
    const ctx = buildOnlineCtx(connection)
    render(<BatailleNavaleGame ctx={ctx} />)

    click('En ligne')
    expect(screen.getByText(/STALE-1/)).toBeTruthy()

    await act(async () => {
      click('Fermer cette salle')
    })

    expect(ctx.realtime.joinRoom).toHaveBeenCalledWith('STALE-1')
    expect(closeSpy).toHaveBeenCalled()
    expect(localStorage.getItem('tiki:bataille-navale:online-room')).toBeNull()
    expect(screen.queryByText(/STALE-1/)).toBeNull()
    // La fermeture ne doit pas nous faire entrer dans cette salle : toujours sur l'écran de choix.
    expect(screen.getByRole('button', { name: 'Créer une partie' })).toBeTruthy()
  })

  test('rejoindre une salle restée ouverte permet de continuer normalement', async () => {
    localStorage.setItem('tiki:bataille-navale:online-room', 'STALE-2')
    placeFleetRandomly.mockReturnValue(FIXED_FLEET)
    const connection = new FakeRealtimeConnection('STALE-2', 1, 1)
    const ctx = buildOnlineCtx(connection)
    render(<BatailleNavaleGame ctx={ctx} />)

    click('En ligne')
    await act(async () => {
      click('Rejoindre cette salle')
    })

    expect(ctx.realtime.joinRoom).toHaveBeenCalledWith('STALE-2')
    expect(await screen.findByText('Place ta flotte')).toBeTruthy()
  })

  test('quitter la salle pendant le placement en ligne efface le code enregistré', async () => {
    placeFleetRandomly.mockReturnValue(FIXED_FLEET)
    const connection = new FakeRealtimeConnection('ROOM-9', 1, 1)
    const closeSpy = vi.spyOn(connection, 'close')
    const ctx = buildOnlineCtx(connection)
    render(<BatailleNavaleGame ctx={ctx} />)

    click('En ligne')
    await act(async () => {
      click('Créer une partie')
    })
    expect(localStorage.getItem('tiki:bataille-navale:online-room')).toBe('ROOM-9')

    click('Quitter cette salle')

    expect(closeSpy).toHaveBeenCalled()
    expect(localStorage.getItem('tiki:bataille-navale:online-room')).toBeNull()
    expect(screen.getByRole('button', { name: 'Solo (même appareil)' })).toBeTruthy()
  })

  test('crée une salle, place sa flotte, envoie READY puis joue un échange de tirs', async () => {
    placeFleetRandomly.mockReturnValue(FIXED_FLEET)
    const connection = new FakeRealtimeConnection('ROOM-1', 1, 1)
    const ctx = buildOnlineCtx(connection)
    render(<BatailleNavaleGame ctx={ctx} />)

    click('En ligne')
    await act(async () => {
      click('Créer une partie')
    })
    expect(await screen.findByText('ROOM-1')).toBeTruthy()

    click('Placer au hasard')
    click('Prêt')

    await screen.findByText("En attente de l'adversaire")
    expect(connection.sent).toContainEqual({ type: 'READY', data: { by: 1 }, actionId: undefined })

    await act(async () => {
      connection.emit('READY', { by: 1 }) // écho de mon propre envoi : le serveur me le renvoie aussi
      connection.emit('READY', { by: 2 })
    })
    expect(await screen.findByText('À toi de tirer')).toBeTruthy()

    click(cellName({ row: 9, col: 9 }))
    expect(connection.sent).toContainEqual({
      type: 'FIRE',
      data: { by: 1, targets: [{ row: 9, col: 9 }] },
      actionId: undefined,
    })

    await act(async () => {
      connection.emit('FIRE_RESULT', { by: 1, targets: [{ row: 9, col: 9 }], results: ['miss'], sunk: [], gameOver: false })
    })
    expect(await screen.findByText("Au tour de l'adversaire")).toBeTruthy()

    await act(async () => {
      connection.emit('FIRE', { by: 2, targets: [{ row: 0, col: 0 }] }) // touche le Porte-avions placé
    })
    expect(connection.sent).toContainEqual({
      type: 'FIRE_RESULT',
      data: { by: 2, targets: [{ row: 0, col: 0 }], results: ['hit'], sunk: [], gameOver: false },
      actionId: undefined,
    })

    await act(async () => {
      connection.emit('FIRE_RESULT', { by: 2, targets: [{ row: 0, col: 0 }], results: ['hit'], sunk: [], gameOver: false })
    })
    // Touché : l'adversaire garde la main (un tir qui touche fait rejouer le même camp).
    expect(await screen.findByText("Au tour de l'adversaire")).toBeTruthy()

    await act(async () => {
      connection.emit('FIRE', { by: 2, targets: [{ row: 1, col: 5 }] }) // case vide de ma flotte fixe : à l'eau
    })
    expect(connection.sent).toContainEqual({
      type: 'FIRE_RESULT',
      data: { by: 2, targets: [{ row: 1, col: 5 }], results: ['miss'], sunk: [], gameOver: false },
      actionId: undefined,
    })

    await act(async () => {
      connection.emit('FIRE_RESULT', { by: 2, targets: [{ row: 1, col: 5 }], results: ['miss'], sunk: [], gameOver: false })
    })
    expect(await screen.findByText('À toi de tirer')).toBeTruthy()

    await act(async () => {
      connection.emit('FIRE_RESULT', {
        by: 1,
        targets: [{ row: 4, col: 0 }, { row: 4, col: 1 }],
        results: ['hit', 'hit'],
        sunk: [FLEET[4]],
        gameOver: false,
      })
    })
    const theirs = within((await screen.findByText('Navires adverses')).closest('div')!)
    expect(theirs.getByText(/^Torpilleur \(coulé\)/)).toBeTruthy()
    expect(theirs.getByText(/^Porte-avions/).closest('li')?.className).not.toContain('sunk')
    // Le mode augmenté n'a pas été coché au menu : aucun bonus ne doit apparaître, même un navire coulé.
    expect(screen.queryByRole('button', { name: /^Salve/ })).toBeNull()
  })

  test('mode augmenté coché au menu : un bonus débloqué apparaît bien en ligne', async () => {
    placeFleetRandomly.mockReturnValue(FIXED_FLEET)
    const connection = new FakeRealtimeConnection('ROOM-4', 1, 1)
    const ctx = buildOnlineCtx(connection)
    render(<BatailleNavaleGame ctx={ctx} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mode augmenté (salve, radar, frappe nucléaire)' }))
    click('En ligne')
    await act(async () => {
      click('Créer une partie')
    })
    click('Placer au hasard')
    click('Prêt')
    await act(async () => {
      connection.emit('READY', { by: 1 })
      connection.emit('READY', { by: 2 })
    })
    await act(async () => {
      connection.emit('FIRE_RESULT', {
        by: 1,
        targets: [{ row: 4, col: 0 }, { row: 4, col: 1 }],
        results: ['hit', 'hit'],
        sunk: [FLEET[4]],
        gameOver: false,
      })
    })

    expect(await screen.findByRole('button', { name: /^Salve/ })).toBeTruthy()
  })

  test('la perte de connexion affiche un message clair, sans reprise', async () => {
    placeFleetRandomly.mockReturnValue(FIXED_FLEET)
    const connection = new FakeRealtimeConnection('ROOM-2', 1, 1)
    const ctx = buildOnlineCtx(connection)
    render(<BatailleNavaleGame ctx={ctx} />)

    click('En ligne')
    await act(async () => {
      click('Créer une partie')
    })
    click('Placer au hasard')
    click('Prêt')
    await screen.findByText("En attente de l'adversaire")

    await act(async () => {
      connection.emit('PLAYER_LEFT', {})
    })

    expect(await screen.findByText('La partie ne peut plus continuer')).toBeTruthy()
    click('Retour au menu')
    expect(screen.getByRole('button', { name: 'Solo (même appareil)' })).toBeTruthy()
  })

  test("le rechargement de la page d'un adversaire déjà en bataille termine la partie, des deux côtés", async () => {
    placeFleetRandomly.mockReturnValue(FIXED_FLEET)
    const connection = new FakeRealtimeConnection('ROOM-3', 1, 1)
    const ctx = buildOnlineCtx(connection)
    render(<BatailleNavaleGame ctx={ctx} />)

    click('En ligne')
    await act(async () => {
      click('Créer une partie')
    })
    click('Placer au hasard')
    click('Prêt')
    await act(async () => {
      connection.emit('READY', { by: 1 })
      connection.emit('READY', { by: 2 })
    })
    expect(await screen.findByText('À toi de tirer')).toBeTruthy()

    // L'adversaire a rechargé sa page : son client reparti de zéro renvoie un READY, qu'on reçoit alors
    // que la bataille est déjà en cours ici.
    await act(async () => {
      connection.emit('READY', { by: 2 })
    })

    expect(await screen.findByText('La partie ne peut plus continuer')).toBeTruthy()
    expect(connection.sent).toContainEqual({ type: 'GAME_ABANDONED', data: null, actionId: undefined })
  })
})
