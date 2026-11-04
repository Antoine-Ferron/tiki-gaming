// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CardDetail } from '../CardDetail'
import { effectIcons, effectText, paymentText } from '../cardText'
import { CityBoard } from '../CityBoard'
import type { Card } from '../cards'
import { Modal } from '../Modal'
import { NeighbourPanel } from '../NeighbourPanel'
import { TurnLog } from '../TurnLog'
import { contract } from './fakes'

afterEach(cleanup)

// Étant donné la table du contrat : alice ("Toi"), "IA 1" à sa droite, "IA 2" à sa gauche.
const [alice, ia1, ia2] = contract.start.players
const atelier = contract.start.hand[6].card
const guild: Card = {
  name: 'Guilde des bâtisseurs',
  age: 3,
  color: 'purple',
  cost: { resources: ['stone', 'stone', 'ore'] },
  guild: ['brown', 'grey'],
}

describe('Affichage de la table', () => {
  it('une IA qui bâtit sa merveille ou défausse garde sa carte face cachée, et ses pièces perdues s’affichent', () => {
    // Quand "IA 2" bâtit une étape de merveille, puis défausse en ayant perdu 2 pièces
    const panel = (action: 'wonder' | 'discard', delta: number) => (
      <NeighbourPanel
        player={ia2}
        side="left"
        myShields={0}
        ready
        bought={[]}
        onOpen={vi.fn()}
        delta={delta}
        stamp="1-2"
        reveal={{ event: { player: 2, action, card: atelier, coins: delta }, paid: 0 }}
      />
    )
    const { rerender } = render(panel('wonder', 0))
    expect(screen.getByText('IA 2 bâtit une étape de sa merveille')).toBeTruthy()
    rerender(panel('discard', -2))

    // Alors la carte n'est jamais nommée, et la perte est affichée
    expect(screen.getByText('IA 2 défausse une carte : +3 pièces')).toBeTruthy()
    expect(screen.queryByText(/Atelier/)).toBeNull()
    expect(screen.getByText('−2')).toBeTruthy()
    // Et un gain s'affiche avec son signe
    rerender(panel('discard', 3))
    expect(screen.getByText('+3')).toBeTruthy()
  })

  it('la cité montre les étapes bâties de la merveille et les pièces perdues au dernier tour', () => {
    // Étant donné alice avec une étape bâtie, qui a perdu 2 pièces
    render(
      <CityBoard player={{ ...alice, stagesBuilt: 1 }} left={ia2} right={ia1} lastCoins={-2} stamp="1-2" needs={[]} />,
    )

    // Alors l'étape 1 est bâtie, la suivante est la prochaine à bâtir, et la perte est affichée en rouge
    const stages = within(screen.getByRole('list', { name: 'Étapes de la merveille' })).getAllByRole('listitem')
    expect(stages.map((stage) => stage.className)).toEqual([
      'sdv-civilisation-stage-built',
      'sdv-civilisation-stage-next',
      'sdv-civilisation-stage-later',
    ])
    expect(document.querySelector('.sdv-civilisation-loss')!.textContent).toMatch(/^[−-]2$/)
  })

  it('le détail d’une carte nomme le voisin de droite à qui la ressource est achetée', () => {
    // Quand le verre de l'Atelier s'achète à "IA 1", à droite
    const needs = [{ resource: 'glass' as const, needed: 1, own: 0, fromLeft: 0, fromRight: 1, missing: 0 }]
    render(
      <CardDetail
        card={atelier}
        player={alice}
        left="IA 2"
        right="IA 1"
        build={{ cost: { ok: true, coins: 2, toLeft: 0, toRight: 2, chain: false }, needs }}
        wonder={{ cost: contract.start.wonder, needs: contract.start.wonderNeeds }}
        onPlay={vi.fn()}
      />,
    )

    // Alors l'achat et son prix sont détaillés
    const build = screen.getByRole('button', { name: /^Construire Atelier/ })
    expect(build.textContent).toContain('1 verre acheté à IA 1')
    expect(build.textContent).toContain('Tu paies 2 pièces, dont 2 à IA 1.')
    expect(paymentText({ ok: true, coins: 4, toLeft: 2, toRight: 2, chain: false }, 'IA 2', 'IA 1')).toBe(
      'Tu paies 4 pièces, dont 2 à IA 2 et 2 à IA 1.',
    )
  })

  it('le journal détaille les conflits de fin d’âge, pour chaque joueur', () => {
    // Étant donné la fin de l'âge I, où alice perd ses deux duels
    const events = [{ ...contract.ageTwo.lastTurn[0], coins: 1 }, ...contract.ageTwo.lastTurn.slice(1)]
    const record = { age: 1 as const, turn: 6, events, conflicts: contract.ageTwo.conflicts! }
    render(<TurnLog history={[record]} players={contract.ageTwo.players} me={0} />)

    // Alors chaque joueur a son total de jetons, signe compris
    expect(screen.getByText('Conflits :').parentElement!.textContent).toBe('Conflits : toi -2 · IA 1 +1 · IA 2 +1')
    // Et une pièce gagnée s'écrit au singulier
    expect(screen.getByText('+1 pièce')).toBeTruthy()
  })

  it('une guilde explique ce qu’elle compte chez les voisins', () => {
    expect(effectText(guild)).toBe('1 point par carte marron ou grise chez tes voisins')
    expect(effectIcons(guild)).toEqual([{ k: 'laurel', n: 1 }, { k: 'mountain' }, { k: 'factory' }])
  })

  it('une fenêtre ne se ferme qu’avec Échap', () => {
    // Mock : on vérifie seulement que la fenêtre demande sa fermeture
    const onClose = vi.fn()
    render(
      <Modal title="Règles du jeu" onClose={onClose}>
        <p>Contenu</p>
      </Modal>,
    )

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
