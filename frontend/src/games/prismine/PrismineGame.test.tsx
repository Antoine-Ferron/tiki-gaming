// @vitest-environment jsdom
/**
 * TI — écran de jeu : le vrai composant React (plateau, journal, sauvegarde) joue une expédition contre un
 * bouchon du serveur arbitre et un faux GameContext. On vérifie ce que voit le joueur et ce qui part au serveur.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RevealedFloor, RunView } from './api'
import { emptyGrid, prism, RED, SE, withPiece } from './engine'
import PrismineGame from './PrismineGame'
import { createFakeContext, runView, stubApi } from './test-doubles'

afterEach(cleanup)

const ID = '00000000-0000-0000-0000-000000000001'
const PROBE = { entry: 0, revealed: false, exit: 12, bounces: 1, color: RED }
const FLOOR_1: RunView = runView({ id: ID, prisms: 1, obsidians: 1, colors: [1, 2] })
const PROBED: RunView = { ...FLOOR_1, oil: 19, totalProbes: 1, probes: [PROBE] }
const FLOOR_2: RunView = { ...FLOOR_1, depth: 2, oil: 26, score: 150, probes: [] }
const revealed = (depth: number): RevealedFloor => ({
  ...FLOOR_1,
  depth,
  grid: withPiece(withPiece(emptyGrid(6), 0, prism(RED, SE)), 35, '#'),
  probes: [PROBE],
})

describe('écran de Prismine', () => {
  it('joue une expédition : tir, pose des pièces, verdicts du serveur, puis fin classée', async () => {
    const { ctx, stored } = createFakeContext({ player: { id: 'joueur-1', username: 'clement' } })
    const api = stubApi({
      startRun: vi.fn().mockResolvedValue(FLOOR_1),
      probe: vi.fn().mockResolvedValue(PROBED),
      validate: vi
        .fn()
        .mockResolvedValueOnce({ kind: 'contradiction', contradictions: [0] })
        .mockResolvedValueOnce({ kind: 'wrong', entry: 5, run: { ...PROBED, oil: 16 } })
        .mockResolvedValueOnce({ kind: 'cleared', points: 150, perfect: false, floor: revealed(1), run: FLOOR_2 }),
      endRun: vi.fn().mockResolvedValue({ floor: revealed(2), run: FLOOR_2, recorded: true }),
    })
    render(<PrismineGame ctx={ctx} api={api} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Jouer' }))
    expect(await screen.findByText(/À trouver : 1 prisme et 1 obsidienne/)).toBeTruthy()
    expect(stored()).toMatchObject({ runId: ID })

    // Tir depuis Haut A : le journal affiche le résultat renvoyé par le serveur.
    const hautA = screen.getByRole('button', { name: 'Haut A : envoyer un faisceau' })
    fireEvent.mouseEnter(hautA)
    fireEvent.click(hautA)
    expect(await screen.findByText(/Haut A → Bas F/)).toBeTruthy()
    expect(api.probe).toHaveBeenCalledExactlyOnceWith(ID, 0)

    // Pose : clic, clic droit, puis clavier (flèche, couleur verte, chiffre, obsidienne, effacement).
    fireEvent.click(screen.getByRole('button', { name: 'A1 : vide' }))
    expect(screen.getByRole('button', { name: 'A1 : prisme rouge, angle en bas à droite' })).toBeTruthy()
    const b1 = screen.getByRole('button', { name: 'B1 : vide' })
    fireEvent.contextMenu(b1)
    fireEvent.keyDown(b1, { key: 'ArrowRight' })
    fireEvent.keyDown(b1, { key: 'v' })
    expect(screen.getByRole('button', { name: 'vert', pressed: true })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('button', { name: 'C1 : vide' }), { key: '2', code: 'Digit2' })
    expect(screen.getByRole('button', { name: 'C1 : prisme vert, angle en bas à gauche' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('button', { name: 'D1 : vide' }), { key: '5', code: 'Digit5' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'D1 : obsidienne' }), { key: 'Backspace' })
    fireEvent.click(screen.getByRole('button', { name: 'rouge' }))
    // A1 rouge ◢, B1 obsidienne (clic droit), C1 vert ◣, D1 effacée. Les sauvegardes s'écrivent l'une après l'autre.
    await vi.waitFor(() => expect(stored()).toMatchObject({ guess: expect.stringMatching(/^a#f\./) }))

    // Les trois verdicts : carte contredite, carte fausse (tir révélé), étage réussi.
    const validate = screen.getByRole('button', { name: 'Valider ma carte' })
    fireEvent.click(validate)
    expect(await screen.findByText(/Ta carte n'explique pas le tir 1/)).toBeTruthy()
    fireEvent.click(validate)
    expect(await screen.findByText(/Raté : le tir depuis Haut F/)).toBeTruthy()
    fireEvent.click(validate)
    expect(await screen.findByText(/Étage 1 réussi : \+150 points/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: "Descendre à l'étage 2" }))

    // Fin d'expédition : la vraie carte est dévoilée, le score a été classé par le serveur.
    fireEvent.click(await screen.findByRole('button', { name: "Terminer l'expédition" }))
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }))
    expect(await screen.findByText("Expédition terminée à l'étage 2.")).toBeTruthy()
    expect(api.endRun).toHaveBeenCalledExactlyOnceWith(ID)
    expect(ctx.submitScore).not.toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(stored()).toMatchObject({ runId: null, stats: { runs: 1, bestDepth: 2, bestScore: 150 } }),
    )
  })
})
