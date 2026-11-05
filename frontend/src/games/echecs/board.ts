// Affichage de l'échiquier : on ne fait que LIRE la FEN renvoyée par le serveur (les règles sont côté Java).

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const // rangée 8 en haut, vue des Blancs

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Symbole Unicode de chaque lettre FEN. */
export const SYMBOLS: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}

const NAMES: Record<string, string> = {
  k: 'roi', q: 'dame', r: 'tour', b: 'fou', n: 'cavalier', p: 'pion',
}

/** Nom lu par un lecteur d'écran : « e2, pion blanc », « d8, dame noire », « e4, case vide ». */
export function squareLabel(square: string, piece: string | undefined): string {
  if (!piece) return `${square}, case vide`
  const white = piece === piece.toUpperCase()
  const name = NAMES[piece.toLowerCase()]
  const feminine = name === 'dame' || name === 'tour'
  const color = white ? (feminine ? 'blanche' : 'blanc') : feminine ? 'noire' : 'noir'
  return `${square}, ${name} ${color}`
}

/** Les pièces de la position, par case (`e2` → `P`). Lettres FEN : majuscule = blanc, minuscule = noir. */
export function piecesFromFen(fen: string): Record<string, string> {
  const pieces: Record<string, string> = {}
  const ranks = fen.split(' ')[0].split('/')
  ranks.forEach((row, index) => {
    const rank = 8 - index // la FEN commence par la rangée 8
    let file = 0
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        file += Number(char)
      } else {
        pieces[`${FILES[file]}${rank}`] = char
        file += 1
      }
    }
  })
  return pieces
}
