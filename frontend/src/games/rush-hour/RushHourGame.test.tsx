// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import { createGameContext } from '../sdk'
import { FakeScores, fakeDeps } from '../testing/fakes'
import RushHourGame from './RushHourGame'

afterEach(cleanup)

const game = { slug: 'rush-hour', scoreLimits: { max: 20000 } }
const player = { id: 'p1', username: 'tanguy' }

/** Le jeu branché sur le vrai GameContext de la plateforme, avec ses fakes en mémoire (aucun réseau). */
function renderGame() {
  const scores = new FakeScores(player)
  const deps = fakeDeps({ scores })
  render(<RushHourGame ctx={createGameContext(game, player, deps)} />)
  return { scores, deps, user: userEvent.setup() }
}

const vehicle = (name: string) => screen.getByRole('button', { name })

// Niveau 1 : le camion C (vertical, à droite) bloque la sortie ; solution = C descend de 1, X avance de 2.
describe('RushHourGame : le niveau 1 se joue au clavier', () => {
  test('affiche le niveau 1, ses 13 véhicules et le compteur de coups', () => {
    // Act
    renderGame()

    // Assert
    expect(screen.getByRole('heading', { name: 'Niveau 1' })).toBeInTheDocument()
    expect(within13Vehicles()).toHaveLength(13)
    expect(vehicle('Voiture rouge')).toBeInTheDocument()
    expect(screen.getByText('Coups : 0 (min. 2)')).toBeInTheDocument()
  })

  test('une flèche dans le sens du véhicule le déplace et compte un coup', async () => {
    // Arrange
    const { user } = renderGame()

    // Act
    vehicle('Camion C, vertical').focus()
    await user.keyboard('{ArrowDown}')

    // Assert
    expect(screen.getByText('Coups : 1 (min. 2)')).toBeInTheDocument()
  })

  test('une flèche dans l’autre axe ne fait rien', async () => {
    // Arrange
    const { user } = renderGame()

    // Act : la voiture rouge est horizontale
    vehicle('Voiture rouge').focus()
    await user.keyboard('{ArrowUp}')

    // Assert
    expect(screen.getByText('Coups : 0 (min. 2)')).toBeInTheDocument()
  })

  test('Annuler est désactivé sans coup, puis annule le dernier coup', async () => {
    // Arrange
    const { user } = renderGame()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    vehicle('Camion C, vertical').focus()
    await user.keyboard('{ArrowDown}')

    // Act
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    // Assert
    expect(screen.getByText('Coups : 0 (min. 2)')).toBeInTheDocument()
  })

  test('Recommencer remet le compteur à zéro', async () => {
    // Arrange
    const { user } = renderGame()
    vehicle('Camion C, vertical').focus()
    await user.keyboard('{ArrowDown}')

    // Act
    await user.click(screen.getByRole('button', { name: 'Recommencer' }))

    // Assert
    expect(screen.getByText('Coups : 0 (min. 2)')).toBeInTheDocument()
  })

  test('la victoire affiche le score et l’envoie au classement', async () => {
    // Arrange
    const { user, scores } = renderGame()

    // Act : C descend d'une case, puis la voiture rouge avance de 2 cases (2 coups = le minimum)
    vehicle('Camion C, vertical').focus()
    await user.keyboard('{ArrowDown}')
    vehicle('Voiture rouge').focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')

    // Assert
    expect(await screen.findByText('Bravo ! 1000 points en 2 coups')).toBeInTheDocument()
    expect(scores.rows.map((r) => r.score)).toEqual([1000])
  })
})

function within13Vehicles() {
  return screen.getAllByRole('button').filter((b) => /^(Voiture|Camion)/.test(b.getAttribute('aria-label') ?? ''))
}
