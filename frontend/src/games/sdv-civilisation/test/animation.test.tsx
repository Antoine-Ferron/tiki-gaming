// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGameContext } from '@/games/sdk'
import { fakeDeps, FakeScores } from '@/games/testing/fakes'
import sdvCivilisation from '..'
import { readTempo, saveTempo, type Tempo } from '../animation'
import type { GameView } from '../game'
import { SdvCivilisationBoard } from '../SdvCivilisationGame'
import { contract, FakeGameServer } from './fakes'

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
/** Le coup part au serveur (promesse) : on attend sa réponse avant de regarder l'écran. */
const send = (name: string | RegExp) => act(async () => click(name))

// Fake : le serveur reprend la partie `saved`, puis répond à chaque coup par la vue suivante.
async function setup(tempo: Tempo, saved: GameView, plays: GameView[]) {
  const alice = { id: 'p1', username: 'alice' }
  const ctx = createGameContext(sdvCivilisation, alice, fakeDeps({ scores: new FakeScores(alice) }))
  const server = new FakeGameServer({ saved, plays })
  render(<SdvCivilisationBoard ctx={ctx} server={server} tempo={tempo} />)
  await act(async () => {})
  return server
}

describe('Animations du tour', () => {
  it('révèle les cartes jouées, fait passer les mains puis arriver la nouvelle main', async () => {
    await setup('normal', contract.start, [contract.turnTwo])
    expect(screen.getByText('Nouvelles cartes de l’âge I')).toBeTruthy()

    click(/^Atelier/)
    await send(/^Construire Atelier/)

    // Révélation : l'écran montre encore le tour 1 et chaque IA dévoile sa carte.
    expect(status()).toContain('Tour 1')
    expect(banner()).toBe('Tous les joueurs ont choisi : les cartes sont révélées.')
    const left = screen.getByRole('region', { name: 'Voisin de gauche : IA 2' })
    expect(within(left).getByText('Tu lui paies 2 pièces')).toBeTruthy()
    expect(within(left).getByText('IA 2 construit Bains')).toBeTruthy()
    expect(document.querySelectorAll('.sdv-civilisation-reveal')).toHaveLength(2)
    expect(document.querySelector('.sdv-civilisation-card-fly')).toBeTruthy()

    nextStep()
    expect(banner()).toBe('Les mains passent ← vers la gauche.')
    expect(document.querySelectorAll('.sdv-civilisation-card-leave')).toHaveLength(6)

    nextStep()
    expect(within(screen.getByRole('region', { name: 'Ta civilisation' })).getByText('Atelier')).toBeTruthy()
    expect(document.querySelector('.sdv-civilisation-passing')!.textContent).toBe('Les mains passent ← vers la gauche')

    nextStep()
    expect(status()).toContain('Tour 2')
    expect(screen.getByText('Main reçue de IA 1')).toBeTruthy()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(6)
  })

  it('laisse passer l’animation, ou la désactiver en cours de tour', async () => {
    await setup('normal', contract.start, [contract.turnTwo, contract.ageTwo])
    fireEvent.change(screen.getByRole('combobox', { name: 'Animations' }), { target: { value: 'fast' } })

    click(/^Bains/)
    await send(/^Bâtir l’étape 1 de ta merveille/)
    click('Passer l’animation')
    expect(status()).toContain('Tour 2')

    click(/^Filon/)
    await send(/^Défausser/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Animations' }), { target: { value: 'off' } })

    expect(status()).toContain('Âge II · Tour 1')
    expect(localStorage.getItem('sdv-civilisation-tempo')).toBe('off')
    expect(readTempo()).toBe('off')
  })

  it('en fin d’âge, montre un duel puis l’autre, puis le nouvel âge, jusqu’à la fin de la partie', async () => {
    await setup('fast', contract.turnTwo, [contract.ageTwo, contract.over])

    click(/^Chantier/)
    await send(/^Défausser/)
    for (let step = 0; step < 3; step++) nextStep()
    const conflicts = () => within(screen.getByLabelText('Conflits militaires')).getAllByRole('listitem')
    expect(conflicts()).toHaveLength(1)
    // Le signe moins dépend de la locale du moteur JavaScript (− ou -).
    expect(conflicts()[0].textContent).toMatch(/^Contre IA 2 : 0 contre 1 — Défaite [−-]1$/)
    nextStep()
    expect(conflicts()).toHaveLength(2)
    nextStep()
    expect(screen.getByLabelText('Changement d’âge').textContent).toBe('Fin de l’âge IÂge II')
    nextStep()
    expect(status()).toBe('Âge II · Tour 1 / 6Les mains passent vers la droite →')
    expect(screen.getByText('Nouvelles cartes de l’âge II')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { pressed: false })[0])
    await send(/^Défausser/)
    expect(banner()).toBe('Tous les joueurs ont choisi : les cartes sont révélées.')
    nextStep()
    expect(banner()).toBe('Les mains passent vers la droite →.')
    for (let step = 0; step < 4; step++) nextStep()
    expect(screen.getByLabelText('Changement d’âge').textContent).toBe('Fin de l’âge IIFin de la partie')
    nextStep()
    expect(screen.getByText('Fin de partie')).toBeTruthy()
  })

  it('raconte aussi le tour joué par le serveur à la place du joueur, minuteur expiré', async () => {
    const server = await setup('normal', contract.start, [])

    // Quand le minuteur expire et que le serveur a défaussé une carte au hasard
    server.saved = contract.turnTwo
    await act(async () => vi.advanceTimersByTime(60_000))

    // Alors les cartes de chacun sont révélées, sans carte qui part de la main du joueur
    expect(banner()).toBe('Tous les joueurs ont choisi : les cartes sont révélées.')
    expect(document.querySelectorAll('.sdv-civilisation-reveal')).toHaveLength(2)
    expect(document.querySelector('.sdv-civilisation-card-fly')).toBeNull()
    expect(screen.queryByText(/Tu lui paies/)).toBeNull()
    for (let step = 0; step < 3; step++) nextStep()
    expect(status()).toContain('Tour 2')
    expect(banner()).toBe('Temps écoulé : une carte de ta main a été défaussée au hasard.')
  })

  it('annonce la défausse des dernières cartes au dernier tour d’un âge', async () => {
    await setup('fast', { ...contract.turnTwo, turn: 6 }, [contract.ageTwo])

    click(/^Chantier/)
    await send(/^Défausser/)
    nextStep()

    expect(banner()).toBe('Fin de l’âge : la dernière carte de chaque main part à la défausse.')
    nextStep()
    expect(screen.getByText('Les dernières cartes partent à la défausse.')).toBeTruthy()
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
