// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import lemur from '.'
import { createGameContext } from '../sdk'
import { fakeDeps } from '../testing/fakes'

afterEach(cleanup)

// Écran provisoire : il remplace la copie du template clicker en attendant l'adaptateur canvas (J3).
// On passe par la définition du jeu, comme la plateforme, pour vérifier aussi le chargement différé.
describe('écran de LemurTiki', () => {
  it('présente le jeu au joueur, en le tutoyant', async () => {
    const ctx = createGameContext(lemur, null, fakeDeps())
    const Game = lemur.component

    render(
      <Suspense fallback={null}>
        <Game ctx={ctx} />
      </Suspense>,
    )

    expect(await screen.findByRole('heading', { name: 'LemurTiki' })).toBeInTheDocument()
    expect(screen.getByText(/grimpe le baobab/i)).toBeInTheDocument()
  })
})
