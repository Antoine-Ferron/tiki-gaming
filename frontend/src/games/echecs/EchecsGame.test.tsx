// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { destinations, play } from './api'
import { ApiError } from '@/lib/api'
import { FakeRealtime } from '../testing/fakes'
import type { GameContext } from '../types'
import { START_FEN } from './board'
import EchecsGame from './EchecsGame'

// Doublure du client API : le test de l'écran ne dépend pas du serveur (stub pour les réponses, mock pour les appels).
vi.mock('./api', () => ({ destinations: vi.fn(), play: vi.fn() }))

beforeEach(() => {
  vi.mocked(destinations).mockReset()
  vi.mocked(play).mockReset()
})

afterEach(cleanup)

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

/** Faux contexte de jeu (comme pour Mastermind) : aucune sauvegarde existante au départ. */
function createContext(): GameContext {
  return {
    gameSlug: 'echecs',
    player: null,
    isGuest: true,
    submitScore: vi.fn().mockResolvedValue(false),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getMyBest: vi.fn().mockResolvedValue(null),
    loadSave: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clearSave: vi.fn().mockResolvedValue(undefined),
    realtime: new FakeRealtime(),
  }
}

function renderGame(ctx: GameContext = createContext()) {
  render(<EchecsGame ctx={ctx} />)
  return ctx
}

/** Choisit la pièce `from` puis joue en `to` (le stub `destinations` doit proposer `to`). */
async function playMove(from: string, to: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${from},`) }))
  await userEvent.click(await screen.findByRole('button', { name: to }))
}

test("l'échiquier affiche 64 cases, chacune utilisable comme un bouton (règle E1, accessibilité)", () => {
  // Arrange + Act
  renderGame()

  // Assert
  const board = screen.getByRole('group', { name: 'Échiquier' })
  expect(within(board).getAllByRole('button')).toHaveLength(64)
})

test('la case h1 est claire et la case a1 est foncée (règle E3)', () => {
  // Arrange + Act
  renderGame()

  // Assert
  expect(screen.getByRole('button', { name: /^h1,/ })).toHaveClass('echecs-square-light')
  expect(screen.getByRole('button', { name: /^a1,/ })).toHaveClass('echecs-square-dark')
})

test('la partie commence sur la position de départ : chaque case annonce sa pièce (règle E4)', () => {
  // Arrange + Act
  renderGame()

  // Assert : nom accessible pour un lecteur d'écran, symbole visible pour les autres
  expect(screen.getByRole('button', { name: 'e1, roi blanc' })).toHaveTextContent('♚')
  expect(screen.getByRole('button', { name: 'd8, dame noire' })).toHaveTextContent('♛')
  expect(screen.getByRole('button', { name: 'e2, pion blanc' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'e4, case vide' })).toHaveTextContent('')
})

test('cliquer une pièce demande ses cases au serveur et les met en évidence', async () => {
  // Arrange : le stub répond comme le serveur pour le pion e2
  vi.mocked(destinations).mockResolvedValue(['e3', 'e4'])
  renderGame()

  // Act
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))

  // Assert : le bon appel (mock), la case choisie et les cases accessibles (stub)
  expect(destinations).toHaveBeenCalledWith(START_FEN, 'e2')
  expect(screen.getByRole('button', { name: 'e2, pion blanc' })).toHaveAttribute('aria-pressed', 'true')
  expect(await screen.findByRole('button', { name: 'e3, case vide' })).toHaveClass('echecs-square-target')
  expect(screen.getByRole('button', { name: 'e4, case vide' })).toHaveClass('echecs-square-target')
  expect(screen.getByRole('button', { name: 'e5, case vide' })).not.toHaveClass('echecs-square-target')
})

test('cliquer une case mise en évidence joue le coup et affiche la position renvoyée par le serveur', async () => {
  // Arrange
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
  vi.mocked(destinations).mockResolvedValue(['e3', 'e4'])
  vi.mocked(play).mockResolvedValue({ fen: afterE4, status: 'ONGOING' })
  renderGame()
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))

  // Act
  await userEvent.click(await screen.findByRole('button', { name: 'e4, case vide' }))

  // Assert : le coup envoyé (mock), la nouvelle position affichée, plus de sélection
  expect(play).toHaveBeenCalledWith(START_FEN, 'e2', 'e4')
  expect(await screen.findByRole('button', { name: 'e4, pion blanc' })).toHaveTextContent('♟')
  expect(screen.getByRole('button', { name: 'e2, case vide' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'e3, case vide' })).not.toHaveClass('echecs-square-target')
})

test('un coup refusé par le serveur affiche son message et laisse la position inchangée', async () => {
  // Arrange : le stub simule le refus des règles (422)
  vi.mocked(destinations).mockResolvedValue(['e3', 'e4'])
  vi.mocked(play).mockRejectedValue(new ApiError(422, 'Coup refusé : Case inaccessible pour la pièce en e2 : e4'))
  renderGame()
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))

  // Act
  await userEvent.click(await screen.findByRole('button', { name: 'e4, case vide' }))

  // Assert
  expect(await screen.findByRole('alert')).toHaveTextContent('Coup refusé : Case inaccessible pour la pièce en e2 : e4')
  expect(screen.getByRole('button', { name: 'e2, pion blanc' })).toBeInTheDocument()
})

test('le trait est annoncé : aux Blancs au départ, aux Noirs après un coup blanc', async () => {
  // Arrange
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue({ fen: AFTER_E4, status: 'ONGOING' })
  renderGame()
  expect(screen.getByRole('status')).toHaveTextContent('Aux Blancs de jouer')

  // Act
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))
  await userEvent.click(await screen.findByRole('button', { name: 'e4, case vide' }))

  // Assert
  expect(await screen.findByText('Aux Noirs de jouer')).toHaveRole('status')
})

test('chaque type de pièce a son nom accessible (cavalier, fou, tour)', () => {
  renderGame()

  expect(screen.getByRole('button', { name: 'b1, cavalier blanc' })).toHaveTextContent('♞')
  expect(screen.getByRole('button', { name: 'c8, fou noir' })).toHaveTextContent('♝')
  expect(screen.getByRole('button', { name: 'h1, tour blanche' })).toHaveTextContent('♜')
})

test('cliquer une case vide sans pièce choisie ne sollicite pas le serveur', async () => {
  renderGame()

  await userEvent.click(screen.getByRole('button', { name: 'e4, case vide' }))

  expect(destinations).not.toHaveBeenCalled()
  expect(play).not.toHaveBeenCalled()
})

test("une case vide qui n'est pas accessible ne joue aucun coup", async () => {
  // Arrange : e2 choisi, ses cases sont e3 et e4
  vi.mocked(destinations).mockResolvedValue(['e3', 'e4'])
  renderGame()
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))
  await screen.findByRole('button', { name: 'e4, case vide' })

  // Act : clic sur e5, hors des cases accessibles
  await userEvent.click(screen.getByRole('button', { name: 'e5, case vide' }))

  // Assert
  expect(play).not.toHaveBeenCalled()
})

test('le message d’erreur disparaît dès que le joueur réessaie', async () => {
  // Arrange : un premier coup refusé
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockRejectedValueOnce(new ApiError(422, 'Coup refusé : essai'))
  renderGame()
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))
  await userEvent.click(await screen.findByRole('button', { name: 'e4, case vide' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()

  // Act : le joueur choisit à nouveau une pièce
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))

  // Assert
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('les pièces sont colorées selon leur camp : blanches en blanc, noires en noir', () => {
  // Arrange + Act
  renderGame()

  // Assert : même symbole plein pour les deux camps, la couleur vient de la classe
  const whiteKing = within(screen.getByRole('button', { name: 'e1, roi blanc' })).getByText('♚')
  const blackKing = within(screen.getByRole('button', { name: 'e8, roi noir' })).getByText('♚')
  expect(whiteKing).toHaveClass('echecs-piece-white')
  expect(blackKing).toHaveClass('echecs-piece-black')
  // décoratif : le nom de la case est déjà lu par le lecteur d'écran
  expect(whiteKing).toHaveAttribute('aria-hidden', 'true')
})

test('après un coup, la case de départ et la case d’arrivée restent marquées (dernier coup joué)', async () => {
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue({ fen: AFTER_E4, status: 'ONGOING' })
  renderGame()

  await playMove('e2', /^e4,/)

  expect(await screen.findByRole('button', { name: 'e4, pion blanc' })).toHaveClass('echecs-square-last')
  expect(screen.getByRole('button', { name: 'e2, case vide' })).toHaveClass('echecs-square-last')
})

test('un roi en échec est annoncé et sa case est mise en évidence (règle P3)', async () => {
  // Arrange : le serveur répond que les Noirs sont en échec
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue({ fen: AFTER_E4, status: 'CHECK' })
  renderGame()

  // Act
  await playMove('e2', /^e4,/)

  // Assert
  expect(await screen.findByText('Échec ! Aux Noirs de jouer')).toHaveRole('status')
  expect(screen.getByRole('button', { name: 'e8, roi noir' })).toHaveClass('echecs-square-check')
})

test('un échec et mat termine la partie : résultat affiché, plus aucun coup possible (F1, F8, P7)', async () => {
  // Arrange : mat du lion, les Blancs sont mats (trait aux Blancs)
  const mate = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue({ fen: mate, status: 'CHECKMATE' })
  renderGame()
  await playMove('e2', /^e4,/)
  expect(await screen.findByText('Échec et mat : les Noirs gagnent (0-1)')).toHaveRole('status')
  vi.mocked(destinations).mockClear()

  // Act : on essaie de jouer encore
  await userEvent.click(screen.getByRole('button', { name: 'a2, pion blanc' }))

  // Assert
  expect(destinations).not.toHaveBeenCalled()
})

test.each([
  ['STALEMATE', 'Pat : partie nulle (½-½)'],
  ['DRAW_INSUFFICIENT_MATERIAL', 'Matériel insuffisant : partie nulle (½-½)'],
  ['DRAW_FIFTY_MOVES', 'Règle des 50 coups : partie nulle (½-½)'],
] as const)('la nulle %s est annoncée avec sa raison (F2, F3, F5)', async (status, message) => {
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue({ fen: AFTER_E4, status })
  renderGame()

  await playMove('e2', /^e4,/)

  expect(await screen.findByText(message)).toHaveRole('status')
})

/** Amène l'écran à une position où le pion blanc e7 peut être promu (le serveur est simulé). */
async function reachPromotion() {
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValueOnce({ fen: 'k7/4P3/8/8/8/8/8/K7 w - - 0 1', status: 'ONGOING' })
  renderGame()
  await playMove('e2', /^e4,/)
  await screen.findByRole('button', { name: 'e7, pion blanc' })
  vi.mocked(destinations).mockResolvedValue(['e8'])
  await playMove('e7', /^e8,/)
}

test('un pion qui atteint la dernière rangée fait choisir sa promotion, envoyée au serveur (S6, P4)', async () => {
  // Arrange
  vi.mocked(play).mockResolvedValue({ fen: 'k3N3/8/8/8/8/8/8/K7 b - - 0 1', status: 'ONGOING' })
  await reachPromotion()
  const dialog = await screen.findByRole('dialog', { name: 'Promotion' })

  // Act
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cavalier' }))

  // Assert
  expect(play).toHaveBeenLastCalledWith('k7/4P3/8/8/8/8/8/K7 w - - 0 1', 'e7', 'e8', 'n')
  expect(await screen.findByRole('button', { name: 'e8, cavalier blanc' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('fermer la fenêtre de promotion annule le coup (P4)', async () => {
  await reachPromotion()
  const dialog = await screen.findByRole('dialog', { name: 'Promotion' })
  vi.mocked(play).mockClear()

  await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))

  expect(play).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'e7, pion blanc' })).toBeInTheDocument()
})

const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'

test('l’historique affiche les coups joués, numérotés (P5)', async () => {
  vi.mocked(destinations).mockResolvedValueOnce(['e4']).mockResolvedValueOnce(['e5'])
  vi.mocked(play)
    .mockResolvedValueOnce({ fen: AFTER_E4, status: 'ONGOING' })
    .mockResolvedValueOnce({ fen: AFTER_E5, status: 'ONGOING' })
  renderGame()

  await playMove('e2', /^e4,/)
  await playMove('e7', /^e5,/)

  expect(await screen.findByRole('listitem')).toHaveTextContent('1. e2-e4 e7-e5')
  expect(screen.getByRole('list', { name: 'Coups joués' })).toBeInTheDocument()
})

test('« Annuler le coup » revient à la position précédente (P6)', async () => {
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue({ fen: AFTER_E4, status: 'ONGOING' })
  renderGame()
  expect(screen.getByRole('button', { name: 'Annuler le coup' })).toBeDisabled()
  await playMove('e2', /^e4,/)
  await screen.findByRole('button', { name: 'e4, pion blanc' })

  await userEvent.click(screen.getByRole('button', { name: 'Annuler le coup' }))

  expect(screen.getByRole('button', { name: 'e2, pion blanc' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Aux Blancs de jouer')
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

test('« Nouvelle partie » remet la position de départ (P6)', async () => {
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue({ fen: AFTER_E4, status: 'ONGOING' })
  renderGame()
  await playMove('e2', /^e4,/)
  await screen.findByRole('button', { name: 'e4, pion blanc' })

  await userEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))

  expect(screen.getByRole('button', { name: 'e2, pion blanc' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Aux Blancs de jouer')
})

test('« Retourner l’échiquier » met les Noirs en bas (P6)', async () => {
  renderGame()
  const firstSquare = () => within(screen.getByRole('group', { name: 'Échiquier' })).getAllByRole('button')[0]
  expect(firstSquare()).toHaveAccessibleName('a8, tour noire')

  await userEvent.click(screen.getByRole('button', { name: 'Retourner l’échiquier' }))

  expect(firstSquare()).toHaveAccessibleName('h1, tour blanche')
})

test('« Abandonner » termine la partie au profit de l’adversaire (F6)', async () => {
  renderGame()

  await userEvent.click(screen.getByRole('button', { name: 'Abandonner' }))

  expect(screen.getByRole('status')).toHaveTextContent('Les Blancs abandonnent : les Noirs gagnent (0-1)')
  expect(screen.getByRole('button', { name: 'Abandonner' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'e2, pion blanc' }))
  expect(destinations).not.toHaveBeenCalled()
})

test('« Nulle par accord » termine la partie sur une nulle (F7)', async () => {
  renderGame()

  await userEvent.click(screen.getByRole('button', { name: 'Nulle par accord' }))

  expect(screen.getByRole('status')).toHaveTextContent('Nulle par accord (½-½)')
})

test('chaque coup est sauvegardé avec l’historique de la partie (SV1)', async () => {
  vi.mocked(destinations).mockResolvedValue(['e4'])
  vi.mocked(play).mockResolvedValue({ fen: AFTER_E4, status: 'ONGOING' })
  const ctx = renderGame()

  await playMove('e2', /^e4,/)

  await vi.waitFor(() => expect(ctx.save).toHaveBeenCalled())
  const saved = vi.mocked(ctx.save).mock.lastCall?.[0] as { history: { fen: string; move: string | null }[] }
  expect(saved.history.map((s) => s.move)).toEqual([null, 'e2-e4'])
  expect(saved.history.at(-1)?.fen).toBe(AFTER_E4)
})

test('une partie sauvegardée propose de reprendre ou de recommencer (SV2)', async () => {
  // Arrange : une sauvegarde après 1. e4
  const ctx = createContext()
  vi.mocked(ctx.loadSave).mockResolvedValue({
    history: [
      { fen: START_FEN, status: 'ONGOING', lastMove: null, move: null, ended: null },
      { fen: AFTER_E4, status: 'ONGOING', lastMove: ['e2', 'e4'], move: 'e2-e4', ended: null },
    ],
  })
  renderGame(ctx)
  const prompt = await screen.findByRole('dialog', { name: 'Partie sauvegardée' })

  // Act
  await userEvent.click(within(prompt).getByRole('button', { name: 'Reprendre' }))

  // Assert
  expect(screen.getByRole('button', { name: 'e4, pion blanc' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Aux Noirs de jouer')
})

test('une sauvegarde illisible est ignorée grâce au schéma (SV3)', async () => {
  const ctx = renderGame()
  await vi.waitFor(() => expect(ctx.loadSave).toHaveBeenCalled())

  const schema = vi.mocked(ctx.loadSave).mock.calls[0][0] as { safeParse(d: unknown): { success: boolean } }
  expect(schema.safeParse({ history: 'cassée' }).success).toBe(false)
  expect(schema.safeParse({ history: [] }).success).toBe(false)
  expect(schema.safeParse(null).success).toBe(false)
  expect(
    schema.safeParse({ history: [{ fen: START_FEN, status: 'ONGOING', lastMove: null, move: null, ended: null }] })
      .success,
  ).toBe(true)
})

test('la sauvegarde est effacée en fin de partie et pour une nouvelle partie (SV4)', async () => {
  const ctx = renderGame()

  await userEvent.click(screen.getByRole('button', { name: 'Abandonner' }))
  await vi.waitFor(() => expect(ctx.clearSave).toHaveBeenCalledTimes(1))
  await userEvent.click(screen.getByRole('button', { name: 'Nouvelle partie' }))

  await vi.waitFor(() => expect(ctx.clearSave).toHaveBeenCalledTimes(2))
})
