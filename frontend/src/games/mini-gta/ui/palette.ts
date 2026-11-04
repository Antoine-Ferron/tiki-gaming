/**
 * Couleurs de la minimap et de la carte, déclarées en variables CSS sur le conteneur du jeu
 * (`mini-gta.css`, section « Carte ») et lues au lancement : aucun code couleur dans le code de l'interface.
 */
const VARS = {
  airfield: '--mini-gta-map-airfield',
  apron: '--mini-gta-map-apron',
  background: '--mini-gta-map-background',
  block: '--mini-gta-map-block',
  building: '--mini-gta-map-building',
  enemy: '--mini-gta-map-enemy',
  glyphText: '--mini-gta-map-glyph-text',
  gunshop: '--mini-gta-map-gunshop',
  highway: '--mini-gta-map-highway',
  hospital: '--mini-gta-map-hospital',
  mission: '--mini-gta-map-mission',
  outline: '--mini-gta-map-outline',
  park: '--mini-gta-map-park',
  pickup: '--mini-gta-map-pickup',
  player: '--mini-gta-map-player',
  police: '--mini-gta-map-police',
  portBlock: '--mini-gta-map-port-block',
  road: '--mini-gta-map-road',
  roadEdge: '--mini-gta-map-road-edge',
  runway: '--mini-gta-map-runway',
  safehouse: '--mini-gta-map-safehouse',
  searchBlue: '--mini-gta-map-search-blue',
  searchRed: '--mini-gta-map-search-red',
  sirenBlue: '--mini-gta-map-siren-blue',
  sirenRed: '--mini-gta-map-siren-red',
  specialBuilding: '--mini-gta-map-special-building',
  waypoint: '--mini-gta-map-waypoint',
} as const

export type MapColor = keyof typeof VARS

export const mapColors = Object.fromEntries(Object.keys(VARS).map((k) => [k, ''])) as Record<MapColor, string>

/** Lit les couleurs depuis les variables CSS de l'élément racine du jeu. */
export function loadMapColors(root: Element) {
  const style = getComputedStyle(root)
  for (const key of Object.keys(VARS) as MapColor[]) mapColors[key] = style.getPropertyValue(VARS[key]).trim()
}
