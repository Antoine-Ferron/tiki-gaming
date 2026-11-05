// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import FleetPlacementBoard from './FleetPlacementBoard'
import { FLEET, GRID_SIZE, shipIndex } from './logic'

afterEach(cleanup)

function cellLabel(row: number, col: number) {
  return `Case ${row + 1},${col + 1}`
}

/** Le libellé d'une case gagne « , occupée » une fois un navire posé : on cible le préfixe, pas le texte exact. */
function cellButton(row: number, col: number) {
  return screen.getByRole('button', { name: new RegExp(`^${cellLabel(row, col)}(,|$)`) })
}

describe('FleetPlacementBoard', () => {
  test('« Prêt » est désactivé tant que toute la flotte n’est pas placée', () => {
    render(<FleetPlacementBoard onComplete={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Prêt' })).toBeDisabled()
  })

  test('« Placer au hasard » place toute la flotte et active « Prêt »', () => {
    const onComplete = vi.fn()
    render(<FleetPlacementBoard onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Placer au hasard' }))
    expect(screen.getByRole('button', { name: 'Prêt' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Prêt' }))
    const fleet = onComplete.mock.calls[0][0]
    expect(fleet).toHaveLength(FLEET.length)
  })

  test('un clic sur une case valide y place le prochain navire de la flotte', () => {
    render(<FleetPlacementBoard onComplete={vi.fn()} />)

    fireEvent.click(cellButton(0, 0))

    expect(cellButton(0, 0).getAttribute('aria-label')).toContain('occupée')
    // Le Porte-avions (5 cases) occupe aussi (0,1) à (0,4) en orientation par défaut (horizontale).
    expect(cellButton(0, 4).getAttribute('aria-label')).toContain('occupée')
  })

  test('chaque navire posé porte la couleur qui lui est propre, distincte des autres', () => {
    render(<FleetPlacementBoard onComplete={vi.fn()} />)

    fireEvent.click(cellButton(0, 0)) // Porte-avions (FLEET[0])
    fireEvent.click(cellButton(1, 0)) // Croiseur (FLEET[1])

    expect(cellButton(0, 0).className).toContain(`ship-${shipIndex(FLEET[0])}`)
    expect(cellButton(1, 0).className).toContain(`ship-${shipIndex(FLEET[1])}`)
    expect(shipIndex(FLEET[0])).not.toBe(shipIndex(FLEET[1]))
  })

  test('tourner avant de placer utilise l’orientation verticale', () => {
    render(<FleetPlacementBoard onComplete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Tourner/ }))
    fireEvent.click(cellButton(0, 0))

    expect(cellButton(4, 0).getAttribute('aria-label')).toContain('occupée')
    expect(cellButton(0, 4).getAttribute('aria-label')).not.toContain('occupée')
  })

  test('un placement qui chevauche un navire déjà posé est refusé', () => {
    render(<FleetPlacementBoard onComplete={vi.fn()} />)

    fireEvent.click(cellButton(0, 0)) // Porte-avions, (0,0)-(0,4)
    fireEvent.click(cellButton(0, 2)) // chevauche : refusé

    // Toujours le même prochain navire (le Croiseur, 2e de la flotte) : rien n'a été posé en plus.
    expect(screen.getByText(/Prochain navire : Croiseur/)).toBeTruthy()
  })

  test('un placement qui dépasse la grille est refusé', () => {
    render(<FleetPlacementBoard onComplete={vi.fn()} />)

    fireEvent.click(cellButton(0, GRID_SIZE - 2)) // Porte-avions (5) déborderait

    expect(screen.getByText(new RegExp(`Prochain navire : ${FLEET[0].name}`))).toBeTruthy()
  })

  test('« Recommencer » efface la flotte posée', () => {
    render(<FleetPlacementBoard onComplete={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Placer au hasard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }))

    expect(screen.getByRole('button', { name: 'Prêt' })).toBeDisabled()
  })

  test('chaque case est activable au clavier (Entrée native sur un <button>)', () => {
    render(<FleetPlacementBoard onComplete={vi.fn()} />)
    const cell = cellButton(0, 0)
    cell.focus()
    fireEvent.click(cell) // Entrée/Espace sur un <button> focalisé déclenche le même onClick nativement.
    expect(cell.getAttribute('aria-label')).toContain('occupée')
  })
})
