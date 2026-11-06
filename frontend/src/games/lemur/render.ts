/**
 * Dessin de LemurTiki sur un canvas. Ne modifie jamais l'état : il ne fait que le lire.
 */
import { BRANCH_HEIGHT, BRANCH_WIDTH, type GameState, MAKI_SIZE, VIEW_HEIGHT, WORLD_WIDTH } from './domain/game'

const COLORS = {
  sky: '#2f4a2c',
  trunk: '#4a3a30',
  branch: '#d9a066',
  maki: '#a3a3a8',
  fossa: '#b5582f',
}

/** La fossa remplit l'écran depuis le bas jusqu'à son museau. */
function drawFossa(surface: CanvasRenderingContext2D, top: number) {
  if (top >= VIEW_HEIGHT) return
  surface.fillStyle = COLORS.fossa
  surface.fillRect(0, top, WORLD_WIDTH, VIEW_HEIGHT - top)
}

/** Dessine la scène vue par la caméra ; l'axe y du monde monte, celui de l'écran descend. */
export function draw(surface: CanvasRenderingContext2D, state: GameState) {
  const toScreen = (y: number) => VIEW_HEIGHT - (y - state.cameraY)

  surface.fillStyle = COLORS.sky
  surface.fillRect(0, 0, WORLD_WIDTH, VIEW_HEIGHT)
  surface.fillStyle = COLORS.trunk
  surface.fillRect(WORLD_WIDTH / 2 - 40, 0, 80, VIEW_HEIGHT)

  surface.fillStyle = COLORS.branch
  for (const b of state.branches) surface.fillRect(b.x, toScreen(b.y + BRANCH_HEIGHT), BRANCH_WIDTH, BRANCH_HEIGHT)

  const { maki } = state
  surface.fillStyle = COLORS.maki
  surface.fillRect(maki.x - MAKI_SIZE / 2, toScreen(maki.y + MAKI_SIZE), MAKI_SIZE, MAKI_SIZE)

  drawFossa(surface, toScreen(state.fossaY))
}
