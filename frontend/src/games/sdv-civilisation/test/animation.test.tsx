// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import sdvCivilisation from '..'
import { readTempo, saveTempo, type Tempo } from '../animation'
import { SdvCivilisationBoard } from '../SdvCivilisationGame'
import { identityShuffler } from './fakes'

// Les étapes du tour s'enchaînent par minuteurs : on les fait avancer à la main, sans attente réelle.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
})

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const status = () => document.querySelector('.sdv-civilisation-status')!.textContent
const banner = () => screen.getByRole('status').textContent
const nextStep = () => act(() => vi.advanceTimersByTime(1500))

function setup(tempo: Tempo) {
  const alice = { id: 'p1', username: 'alice' }
  const ctx = createGameContext(sdvCivilisation, alice, fakeDeps({ scores: new FakeScores(alice) }))
  render(<SdvCivilisationBoard ctx={ctx} shuffler={identityShuffler} tempo={tempo} />)
  click('Choisir Temple d’Ysar')
}

describe('Animations du tour', () => {
  it('révèle les cartes jouées, fait passer les mains puis arriver la nouvelle main', () => {
    setup('normal')
    expect(screen.getByText('Nouvelles cartes de l’âge I')).toBeTruthy()

    click(/^Palissade/)
    click(/^Construire Palissade/)

    // Révélation : l'écran montre encore le tour 1 et chaque IA dévoile sa carte.
    expect(status()).toContain('Tour 1')
    expect(banner()).toBe('Tous les joueurs ont choisi : les cartes sont révélées.')
    const left = screen.getByRole('region', { name: 'Voisin de gauche : IA 2' })
    expect(within(left).getByText('Tu lui paies 2 pièces')).toBeTruthy()
    expect(document.querySelectorAll('.sdv-civilisation-reveal')).toHaveLength(2)
    expect(document.querySelector('.sdv-civilisation-card-fly')).toBeTruthy()

    nextStep()
    expect(banner()).toBe('Les mains passent ← vers la gauche.')
    expect(document.querySelectorAll('.sdv-civilisation-card-leave')).toHaveLength(6)

    nextStep()
    expect(within(screen.getByRole('region', { name: 'Ta civilisation' })).getByText('Palissade')).toBeTruthy()
    expect(document.querySelector('.sdv-civilisation-passing')!.textContent).toBe('Les mains passent ← vers la gauche')

    nextStep()
    expect(status()).toContain('Tour 2')
    expect(screen.getByText('Main reçue de IA 1')).toBeTruthy()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('laisse passer l’animation, ou la désactiver en cours de tour', () => {
    setup('normal')
    fireEvent.change(screen.getByRole('combobox', { name: 'Animations' }), { target: { value: 'fast' } })

    click(/^Bains/)
    click(/^Bâtir l’étape 1 de ta merveille/)
    click('Passer l’animation')
    expect(status()).toContain('Tour 2')

    click(/^Filon/)
    click(/^Défausser/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Animations' }), { target: { value: 'off' } })

    expect(status()).toContain('Tour 3')
    expect(localStorage.getItem('sdv-civilisation-tempo')).toBe('off')
    expect(readTempo()).toBe('off')
  })

  it('en fin d’âge, montre un duel puis l’autre, puis le nouvel âge, jusqu’à la fin de la partie', () => {
    setup('fast')
    const playTurn = () => {
      fireEvent.click(screen.getAllByRole('button', { pressed: false })[0])
      click(/^Défausser/)
    }

    for (let turn = 0; turn < 5; turn++) {
      playTurn()
      for (let step = 0; step < 3; step++) nextStep()
    }
    playTurn()
    nextStep()
    expect(banner()).toBe('Fin de l’âge : la dernière carte de chaque main part à la défausse.')
    nextStep()
    expect(screen.getByText('Les dernières cartes partent à la défausse.')).toBeTruthy()
    nextStep()
    const conflicts = () => within(screen.getByLabelText('Conflits militaires')).getAllByRole('listitem')
    expect(conflicts()).toHaveLength(1)
    expect(conflicts()[0].textContent).toMatch(/^Contre IA 2 : 0 contre \d/)
    nextStep()
    expect(conflicts()).toHaveLength(2)
    nextStep()
    expect(screen.getByLabelText('Changement d’âge').textContent).toBe('Fin de l’âge IÂge II')
    nextStep()
    expect(status()).toBe('Âge II · Tour 1 / 6Les mains passent vers la droite →')
    expect(screen.getByText('Nouvelles cartes de l’âge II')).toBeTruthy()

    playTurn()
    nextStep()
    expect(banner()).toBe('Les mains passent vers la droite →.')
    for (let step = 0; step < 2; step++) nextStep()
    expect(screen.getByText('Main reçue de IA 2')).toBeTruthy()

    while (!screen.queryByLabelText('Changement d’âge')?.textContent?.includes('Fin de la partie')) {
      if (screen.queryAllByRole('button', { pressed: false }).length > 0 && !screen.queryByText('Passer l’animation')) {
        playTurn()
      }
      nextStep()
    }
    nextStep()
    expect(screen.getByText('Fin de partie')).toBeTruthy()
  })
})

describe('Préférence de tempo', () => {
  it('est lue et gardée dans le navigateur, et revient aux animations normales si le stockage est indisponible', () => {
    expect(readTempo()).toBe('normal')
    saveTempo('fast')
    expect(readTempo()).toBe('fast')
    localStorage.setItem('sdv-civilisation-tempo', 'turbo')
    expect(readTempo()).toBe('normal')

    // Stub : le stockage refuse tout accès (navigation privée, données bloquées).
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    expect(readTempo()).toBe('normal')
    expect(() => saveTempo('off')).not.toThrow()
    vi.restoreAllMocks()
  })
})
