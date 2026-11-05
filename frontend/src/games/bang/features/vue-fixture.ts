import type { GameView } from '../board/view'

/** Partie à quatre joueurs vue depuis la place 1 : le Shérif (rôle public) est à la place 3. */
export function fourPlayerView(): GameView {
  return {
    code: 'ABC123',
    seat: 1,
    currentSeat: 3,
    phase: 'PLAY',
    role: 'OUTLAW',
    hand: [
      { id: 'BANG-1', type: 'BANG' },
      { id: 'MISSED-1', type: 'MISSED' },
      { id: 'BANG-2', type: 'BANG' },
    ],
    players: [
      { seat: 1, character: 'BART_CASSIDY', health: 4, maxHealth: 4, playedCards: [], handCount: 3 },
      { seat: 2, character: 'CALAMITY_JANET', health: 3, maxHealth: 4, playedCards: [], handCount: 2 },
      { seat: 3, character: 'PAUL_REGRET', health: 4, maxHealth: 4, playedCards: [], handCount: 3, role: 'SHERIFF' },
      { seat: 4, character: 'WILLY_THE_KID', health: 4, maxHealth: 4, playedCards: [], handCount: 4 },
    ],
  }
}
