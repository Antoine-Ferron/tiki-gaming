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

  test('un tir qui touche sans couler annonce « Touché ! »', async () => {
    startLocalGame()

    click(cellName({ row: 0, col: 0 })) // Porte-avions (taille 5) : une seule case touchée

    expect(await screen.findByText('Touché !')).toBeTruthy()
  })

  test('couler un navire sur deux tours distincts annonce le navire coulé', async () => {
    startLocalGame()

    click(cellName({ row: 4, col: 0 })) // Torpilleur (taille 2), 1ère case
    await screen.findByText('Touché !')
    click('Je suis prêt')

    click(cellName({ row: 9, col: 9 })) // joueur 2 : tir sans danger
    await screen.findByText("À l'eau.")
    click('Je suis prêt')

    click(cellName({ row: 4, col: 1 })) // Torpilleur, 2e et dernière case
    expect(await screen.findByText('Torpilleur coulé !')).toBeTruthy()

    click('Je suis prêt') // passe au joueur 2
    click(cellName({ row: 9, col: 8 }))
    await screen.findByText(/^(Touché !|À l'eau\.)$/)
    click('Je suis prêt') // revient au joueur 1 : le panneau doit refléter le Torpilleur coulé

    const theirs = within(screen.getByText('Navires adverses').closest('div')!)
    expect(theirs.getByText(/^Torpilleur \(coulé\)/)).toBeTruthy()
    expect(theirs.getByText(/^Porte-avions/).closest('li')?.className).not.toContain('sunk')
  })

  test('au tour suivant du même joueur, ses tirs précédents restent marqués et désactivés', async () => {
    startLocalGame()
    click(cellName({ row: 0, col: 0 }))
    await screen.findByText('Touché !')
    click('Je suis prêt')

    click(cellName({ row: 9, col: 9 }))
    await screen.findByText("À l'eau.")
    click('Je suis prêt')

    expect(screen.getByText('Au tour du joueur 1')).toBeTruthy()
    const firstCell = screen.getByRole('button', { name: new RegExp(`^${cellName({ row: 0, col: 0 })}(,|$)`) })
    expect(firstCell).toBeDisabled()
    expect(firstCell.className).toContain('hit')
  })

  /** Le joueur 1 coule toute la flotte adverse (fixe) ; le joueur 2 ne fait que des tirs sans danger. */
  async function sinkWholeOpponentFleet() {
    const player1Targets = FIXED_FLEET.flatMap((p) => p.coords) // 17 cases au total
    const player2SafeCells: Coord[] = []
    for (let row = 5; row < GRID_SIZE && player2SafeCells.length < player1Targets.length; row++) {
      for (let col = 0; col < GRID_SIZE && player2SafeCells.length < player1Targets.length; col++) {
        player2SafeCells.push({ row, col })
      }
    }

    for (let i = 0; i < player1Targets.length; i++) {
      click(cellName(player1Targets[i]))
      if (i === player1Targets.length - 1) break
      await screen.findByRole('button', { name: 'Je suis prêt' })
      click('Je suis prêt')

      click(cellName(player2SafeCells[i]))
      await screen.findByRole('button', { name: 'Je suis prêt' })
      click('Je suis prêt')
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
