/** Un niveau du mode Niveaux. La map est écrite en 6 lignes de 6 cases (voir docs/games/rush-hour/regles.md). */
export interface Level {
  id: number
  map: string[]
}

// '.' = case vide, 'X' = voiture rouge (3ᵉ ligne, sortie à droite), autre lettre = un véhicule.
// Classés par minimum de coups croissant : 1–6 Facile, 7–13 Moyen, 14–20 Difficile (vérifié par levels.test.ts).
// Une ligne de code par ligne du plateau : on empêche Prettier de tout mettre sur une ligne.
// prettier-ignore
const MAPS: string[][] = [
  // Niveau 1 : 3 coups
  ['.FCCA.', '.F..AH', '.XX.AH', '..B..G', 'EDB..G', 'ED....'],
  // Niveau 2 : 4 coups
  ['....A.', 'DD.GAB', '.XXGAB', '...C.E', 'FF.C.E', '...C.E'],
  // Niveau 3 : 5 coups
  ['..FFA.', 'CC.DAB', '.XXDAB', '......', '...E..', '...E..'],
  // Niveau 4 : 6 coups
  ['..EEA.', '...CAB', '.XXCAB', 'HH.II.', 'FF.D..', 'GG.D..'],
  // Niveau 5 : 7 coups
  ['G.HHA.', 'G..CAB', 'GXXCAB', 'EE.FF.', '......', '...DD.'],
  // Niveau 6 : 8 coups
  ['HHGGA.', '...CAB', '.XXCAB', 'EE.FFI', '.....I', '...DD.'],
  // Niveau 7 : 9 coups
  ['HHGGA.', '...CAB', '.XXCAB', 'EE.FFI', '.JJJ.I', '...DD.'],
  // Niveau 8 : 10 coups
  ['...A.D', 'II.AED', 'BXXAED', 'B..GG.', 'F.CCC.', 'F...HH'],
  // Niveau 9 : 11 coups
  ['HH.FF.', '...C..', 'XXBCIE', 'JJB.IE', '.GAADD', '.G....'],
  // Niveau 10 : 12 coups
  ['JJJA.D', 'II.AED', 'BXXAED', 'B..GG.', 'F.CCC.', 'F...HH'],
  // Niveau 11 : 13 coups
  ['..EDDD', '..EB..', '.XXB.A', 'FFFCGA', '...CG.', '.HH.G.'],
  // Niveau 12 : 14 coups
  ['..EDDD', 'H.EB..', 'HXXB.A', 'FFFCGA', '...CGI', '....GI'],
  // Niveau 13 : 15 coups
  ['.IG.CC', '.IGB.E', 'XXHBDE', '..H.D.', '..HJFF', 'AAAJ..'],
  // Niveau 14 : 17 coups
  ['.EEE..', '...B.A', '.XXBDA', '...BDG', '.IHFFG', '.IHCC.'],
  // Niveau 15 : 18 coups
  ['.BBBH.', '..E.HD', 'XXECHD', '.F.C.D', 'JFACII', 'J.AGG.'],
  // Niveau 16 : 19 coups
  ['..DDDG', '.II..G', 'XXFB.G', '.HFBKK', 'EHC.AA', 'E.C.JJ'],
  // Niveau 17 : 20 coups
  ['II.EJB', '...EJB', '.XXC.B', '.H.CDD', '.HA.FF', '..AGGG'],
  // Niveau 18 : 22 coups
  ['..FBBB', '..FJCI', '.XXJCI', 'KHEAAA', 'KHEGG.', '.DD...'],
  // Niveau 19 : 24 coups
  ['.EEE..', '...B.A', 'JXXBDA', 'J..BDG', 'JIHFFG', '.IHCC.'],
  // Niveau 20 : 26 coups
  ['..DDDG', '.II.LG', 'XXFBLG', '.HFBKK', 'EHC.AA', 'E.C.JJ'],
]

/** Les 20 niveaux, numérotés de 1 à 20. */
export const levels: Level[] = MAPS.map((map, i) => ({ id: i + 1, map }))

export function getLevel(id: number): Level {
  return levels[id - 1]
}
