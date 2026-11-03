// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Results } from '../Results'

afterEach(cleanup)

describe('Results', () => {
  it('félicite le gagnant, invite l’invité à se connecter et relance une partie', () => {
    const score = { military: 2, treasury: 3, wonder: 0, civil: 8, science: 1, guilds: 0, total: 14 }
    // Mock : on vérifie seulement que « Rejouer » prévient l'écran de jeu.
    const onReplay = vi.fn()
    render(<Results ranked={[{ name: 'Toi', isBot: false, coins: 9, score }]} me="Toi" isGuest onReplay={onReplay} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }))

    expect(screen.getByText('Tu as gagné !')).toBeTruthy()
    expect(screen.getByText('Connecte-toi pour apparaître au classement.')).toBeTruthy()
    expect(onReplay).toHaveBeenCalledOnce()
  })

  it('annonce une victoire partagée quand total et pièces sont égaux', () => {
    const score = { military: 0, treasury: 1, wonder: 3, civil: 0, science: 0, guilds: 0, total: 4 }
    const ranked = [
      { name: 'Toi', isBot: false, coins: 3, score },
      { name: 'IA 1', isBot: true, coins: 3, score },
    ]
    render(<Results ranked={ranked} me="Toi" isGuest={false} onReplay={vi.fn()} />)

    expect(screen.getByText('Égalité : victoire partagée entre toi et IA 1.')).toBeTruthy()
  })
})
