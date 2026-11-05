// Affichage de l'échiquier : on ne fait que LIRE la FEN renvoyée par le serveur (les règles sont côté Java).

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

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
