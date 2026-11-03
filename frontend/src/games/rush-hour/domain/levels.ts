/** Un niveau du mode Niveaux. La map est écrite en 6 lignes de 6 cases (voir docs/rush-hour). */
export interface Level {
  id: number
  map: string[]
}

// '.' = case vide, 'X' = voiture rouge (ligne 3, sortie à droite), autre lettre = un véhicule
const LEVEL_1: Level = {
  id: 1,
  // Une ligne de code par ligne du plateau : on empêche Prettier de tout mettre sur une ligne.
  // prettier-ignore
  map: [
    '.HFFD.',
    '.HGGD.',
    'I.XX.C',
    'IBBL.C',
    '.EELAC',
    'JJKKA.',
  ],
}

const LEVELS: Record<number, Level> = { 1: LEVEL_1 }

export function getLevel(id: number): Level {
  return LEVELS[id]
}
