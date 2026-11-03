// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Results } from '../Results'

describe('Results', () => {
  it('félicite le gagnant, invite l’invité à se connecter et relance une partie', () => {
    const score = { military: 2, treasury: 3, civil: 8, science: 1, total: 14 }
    // Mock : on vérifie seulement que « Rejouer » prévient l'écran de jeu.
    const onReplay = vi.fn()
    render(<Results ranked={[{ name: 'Toi', isBot: false, coins: 9, score }]} me="Toi" isGuest onReplay={onReplay} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }))

    expect(screen.getByText('Tu as gagné !')).toBeTruthy()
    expect(screen.getByText('Connecte-toi pour apparaître au classement.')).toBeTruthy()
    expect(onReplay).toHaveBeenCalledOnce()
  })
})
