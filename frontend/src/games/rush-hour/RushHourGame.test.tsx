// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import { GameError } from '../errors'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import { vehicleLabel } from './components/vehicleLabel'
import { type Board, type Move, parseBoard } from './domain/board'
import { generateBoard } from './domain/generator'
import { getLevel } from './domain/levels'
import { solve } from './domain/solver'
import { seededRandom } from './testing/seededRandom'
import { levelsVerifier, refuseWith } from './testing/verifiers'
import RushHourGame from './RushHourGame'

afterEach(cleanup)

const game = { slug: 'rush-hour', scoreLimits: { max: 20000 } }
const player = { id: 'p1', username: 'tanguy' }

// Les tests jouent la solution du solveur : ils ne dépendent pas du dessin du niveau 1.
/**
 * Valeur calculée au premier appel, dans un test, puis gardée. Un calcul fait au chargement du fichier rendrait
 * « statiques » les mutants du domaine : Stryker ne saurait plus quels tests les couvrent et relancerait toute la suite.
 */
function lazy<T>(compute: () => T): () => T {
  let value: { v: T } | undefined
  return () => (value ??= { v: compute() }).v
}

const LEVEL_1 = lazy((): Board => parseBoard(getLevel(1).map))
const SOLUTION = lazy(() => solve(LEVEL_1())!)
const OPTIMAL = lazy(() => SOLUTION().length)

/**
 * Le jeu branché sur le vrai GameContext de la plateforme, avec ses fakes en mémoire (aucun réseau),
 * puis ouvert sur le niveau 1 depuis l'écran de choix.
 */
async function renderGame() {
  const scores = new FakeScores(player)
  render(<RushHourGame ctx={createGameContext(game, player, fakeDeps({ scores }))} verifyLevel={levelsVerifier} />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /^Niveau 1\b/ }))
  return { scores, user }
}

function labelOf(id: string, board: Board = LEVEL_1()) {
  return vehicleLabel(board.vehicles.find((v) => v.id === id)!)
}

/** Flèches à presser pour jouer un coup au clavier (une flèche = une case). */
function keysFor(move: Move, board: Board = LEVEL_1()) {
  const horizontal = board.vehicles.find((v) => v.id === move.id)!.orientation === 'H'
  const key = horizontal ? (move.delta > 0 ? 'ArrowRight' : 'ArrowLeft') : move.delta > 0 ? 'ArrowDown' : 'ArrowUp'
  return `{${key}}`.repeat(Math.abs(move.delta))
}

async function playKeys(user: ReturnType<typeof userEvent.setup>, move: Move, keys = keysFor(move)) {
  screen.getByRole('button', { name: labelOf(move.id) }).focus()
  await user.keyboard(keys)
}

const counter = (moves: number) => screen.getByText(`Coups : ${moves} (min. ${OPTIMAL()})`)

describe('RushHourGame : le niveau 1 se joue au clavier', () => {
  test('affiche le niveau 1, tous ses véhicules et le compteur de coups', async () => {
    // Act
    await renderGame()

    // Assert
    expect(screen.getByRole('heading', { name: 'Niveau 1' })).toBeInTheDocument()
    for (const v of LEVEL_1().vehicles)
      expect(screen.getByRole('button', { name: vehicleLabel(v) })).toBeInTheDocument()
    expect(counter(0)).toBeInTheDocument()
  })

  test('une flèche dans le sens du véhicule le déplace et compte un coup', async () => {
    // Arrange
    const { user } = await renderGame()
    const first = SOLUTION()[0]

    // Act : une seule case dans le sens du premier coup de la solution
    await playKeys(user, first, keysFor({ ...first, delta: Math.sign(first.delta) }))

    // Assert
    expect(counter(1)).toBeInTheDocument()
  })

  test('une flèche dans l’autre axe ne fait rien', async () => {
    // Arrange
    const { user } = await renderGame()

    // Act : la voiture rouge est horizontale
    await playKeys(user, { id: 'X', delta: 0 }, '{ArrowUp}')

    // Assert
    expect(counter(0)).toBeInTheDocument()
  })

  test('Annuler est désactivé sans coup, puis annule le dernier coup', async () => {
    // Arrange
    const { user } = await renderGame()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    await playKeys(user, SOLUTION()[0])

    // Act
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    // Assert
    expect(counter(0)).toBeInTheDocument()
  })

  test('Recommencer remet le compteur à zéro', async () => {
    // Arrange
    const { user } = await renderGame()
    await playKeys(user, SOLUTION()[0])

    // Act
    await user.click(screen.getByRole('button', { name: 'Recommencer' }))

    // Assert
    expect(counter(0)).toBeInTheDocument()
  })

  test('jouer la solution la plus courte gagne avec 1000 points, envoyés au classement', async () => {
    // Arrange
    const { user, scores } = await renderGame()

    // Act
    for (const move of SOLUTION()) await playKeys(user, move)

    // Assert
    expect(await screen.findByText(`Bravo ! 1000 points en ${OPTIMAL()} coups`)).toBeInTheDocument()
    expect(scores.rows.map((r) => r.score)).toEqual([1000])
  })
})

/** Ouvre le jeu sur l'écran de choix, avec une progression déjà sauvegardée (records par niveau). */
async function renderPicker(best: Record<number, number> = {}, random = seededRandom(1)) {
  const scores = new FakeScores(player)
  const deps = fakeDeps({ scores })
  deps.saves.data.set('rush-hour', { version: 1, best })
  render(<RushHourGame ctx={createGameContext(game, player, deps)} random={random} verifyLevel={levelsVerifier} />)
  await screen.findByRole('heading', { name: 'Niveaux' })
  return { user: userEvent.setup(), scores }
}

const levelButton = (id: number) => screen.getByRole('button', { name: new RegExp(`^Niveau ${id}\\b`) })

describe('RushHourGame : choix des niveaux et progression (N3, N4, N5, S3)', () => {
  test('au départ, seul le niveau 1 est ouvert', async () => {
    // Act
    await renderPicker()

    // Assert
    expect(levelButton(1)).toBeEnabled()
    expect(levelButton(2)).toBeDisabled()
    expect(levelButton(20)).toBeDisabled()
  })

  test('un niveau terminé ouvre le suivant et affiche son record', async () => {
    // Act
    await renderPicker({ 1: 800 })

    // Assert
    expect(levelButton(1)).toHaveAccessibleName(/800 points/)
    expect(levelButton(2)).toBeEnabled()
    expect(levelButton(3)).toBeDisabled()
  })

  test('affiche le score total, somme des records', async () => {
    // Act
    await renderPicker({ 1: 800, 2: 950 })

    // Assert
    expect(screen.getByText('Score total : 1750 points')).toBeInTheDocument()
  })

  test('choisir un niveau ouvert lance la partie, et on peut revenir aux niveaux', async () => {
    // Arrange
    const { user } = await renderPicker({ 1: 800 })

    // Act
    await user.click(levelButton(2))

    // Assert
    expect(screen.getByRole('heading', { name: 'Niveau 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Niveaux' }))
    expect(screen.getByRole('heading', { name: 'Niveaux' })).toBeInTheDocument()
  })

  test('après une victoire, « Niveau suivant » lance le niveau 2', async () => {
    // Arrange
    const { user } = await renderPicker()
    await user.click(levelButton(1))
    for (const move of SOLUTION()) await playKeys(user, move)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Niveau suivant' }))

    // Assert
    expect(screen.getByRole('heading', { name: 'Niveau 2' })).toBeInTheDocument()
  })
})

describe('RushHourGame : indices (P5)', () => {
  test('un indice indique le véhicule à déplacer, le sens et la distance', async () => {
    // Arrange
    const { user } = await renderGame()

    // Act
    await user.click(screen.getByRole('button', { name: 'Indice (−200 points)' }))

    // Assert
    expect(screen.getByText(new RegExp(`^Indice : ${labelOf(SOLUTION()[0].id)}`))).toBeInTheDocument()
  })

  test('chaque indice coûte 200 points au score du niveau', async () => {
    // Arrange
    const { user, scores } = await renderGame()
    await user.click(screen.getByRole('button', { name: 'Indice (−200 points)' }))

    // Act
    for (const move of SOLUTION()) await playKeys(user, move)

    // Assert
    expect(await screen.findByText(`Bravo ! 800 points en ${OPTIMAL()} coups`)).toBeInTheDocument()
    expect(scores.rows.map((r) => r.score)).toEqual([800])
  })
})

describe('RushHourGame : mode Génération (G1, G5, G6, S4)', () => {
  // Même graine que le jeu : le test connaît le plateau généré et sa solution.
  const GENERATED = lazy(() => parseBoard(generateBoard('facile', seededRandom(1))))
  const GENERATED_SOLUTION = lazy(() => solve(GENERATED())!)

  async function playGenerated(user: ReturnType<typeof userEvent.setup>) {
    for (const move of GENERATED_SOLUTION()) {
      screen.getByRole('button', { name: labelOf(move.id, GENERATED()) }).focus()
      await user.keyboard(keysFor(move, GENERATED()))
    }
  }

  test('choisir Facile lance un plateau généré, avec son minimum de coups', async () => {
    // Arrange
    const { user } = await renderPicker()

    // Act
    await user.click(screen.getByRole('button', { name: 'Facile' }))

    // Assert
    expect(screen.getByRole('heading', { name: 'Plateau Facile' })).toBeInTheDocument()
    expect(screen.getByText(`Coups : 0 (min. ${GENERATED_SOLUTION().length})`)).toBeInTheDocument()
  })

  test('un plateau généré se gagne comme un niveau, mais ne compte pas au classement', async () => {
    // Arrange
    const { user, scores } = await renderPicker()
    await user.click(screen.getByRole('button', { name: 'Facile' }))

    // Act
    await playGenerated(user)

    // Assert
    expect(await screen.findByText(`Bravo ! 1000 points en ${GENERATED_SOLUTION().length} coups`)).toBeInTheDocument()
    expect(scores.rows).toEqual([])
  })

  test('les plateaux réussis sont comptés par difficulté sur l’écran de choix', async () => {
    // Arrange
    const { user } = await renderPicker()
    await user.click(screen.getByRole('button', { name: 'Facile' }))
    await playGenerated(user)
    await screen.findByText(/^Bravo/)

    // Act
    await user.click(screen.getByRole('button', { name: '← Niveaux' }))

    // Assert
    expect(screen.getByText('Facile : 1 plateau réussi, record 1000 points')).toBeInTheDocument()
  })

  test('« Nouveau plateau » relance un plateau de la même difficulté', async () => {
    // Arrange
    const { user } = await renderPicker()
    await user.click(screen.getByRole('button', { name: 'Facile' }))
    await playGenerated(user)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Nouveau plateau' }))

    // Assert
    expect(screen.getByRole('heading', { name: 'Plateau Facile' })).toBeInTheDocument()
    expect(screen.getByText(/^Coups : 0 /)).toBeInTheDocument()
  })
})

// Robustesse : une panne du serveur s'affiche en message lisible, sans bloquer le jeu (REQ-ERR-01 de la plateforme).
describe('RushHourGame : pannes du serveur', () => {
  const outage = new GameError('network', 'Le serveur ne répond pas')

  test('classement indisponible : le message s’affiche et les niveaux restent jouables', async () => {
    // Arrange : Fake du classement en panne
    const scores = new FakeScores(player)
    scores.leaderboard = () => Promise.reject(outage)

    // Act
    render(<RushHourGame ctx={createGameContext(game, player, fakeDeps({ scores }))} verifyLevel={levelsVerifier} />)

    // Assert
    expect(await screen.findByText('Le serveur ne répond pas')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^Niveau 1\b/ })).toBeEnabled()
  })

  test('progression illisible : le message s’affiche et le joueur repart du niveau 1', async () => {
    // Arrange : Fake des sauvegardes en panne
    const deps = fakeDeps()
    deps.saves.load = () => Promise.reject(outage)

    // Act
    render(<RushHourGame ctx={createGameContext(game, player, deps)} verifyLevel={levelsVerifier} />)

    // Assert
    expect(await screen.findByText('Le serveur ne répond pas')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /^Niveau 1\b/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Niveau 2\b/ })).toBeDisabled()
  })

  test('partie refusée par le serveur : le refus s’affiche, sans score ni envoi au classement', async () => {
    // Arrange : Stub du serveur, qui refuse la partie
    const scores = new FakeScores(player)
    const ctx = createGameContext(game, player, fakeDeps({ scores }))
    render(<RushHourGame ctx={ctx} verifyLevel={refuseWith('Partie refusée : Déplacement impossible : X de 3')} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^Niveau 1\b/ }))

    // Act
    for (const move of SOLUTION()) await playKeys(user, move)

    // Assert
    expect(await screen.findByText('Partie refusée : Déplacement impossible : X de 3')).toBeInTheDocument()
    expect(screen.queryByText(/^Bravo/)).not.toBeInTheDocument()
    expect(scores.rows).toEqual([])
  })
})
