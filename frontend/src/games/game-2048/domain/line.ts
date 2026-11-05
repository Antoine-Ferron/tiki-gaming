/** Une ligne lue dans le sens du glissement ; 0 = case vide. */
export type Line = readonly number[]

export interface SlideResult {
  line: number[]
  points: number
}

/** Fait glisser une ligne vers sa case 0 : chaque tuile ne fusionne qu'une fois par coup (R2 à R5). */
export function slideLine(line: Line): SlideResult {
  const tiles = line.filter((value) => value !== 0)
  const result: number[] = []
  let points = 0

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2
      result.push(merged)
      points += merged
      i++
    } else {
      result.push(tiles[i])
    }
  }

  while (result.length < line.length) result.push(0)
  return { line: result, points }
}
