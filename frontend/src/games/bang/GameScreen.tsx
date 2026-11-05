import { BangBoard } from './board/BangBoard'
import { turnHint, type GameView } from './board/view'

/** L'écran de jeu, commun à la partie en ligne et à la partie locale : étape en cours, boutons de tour et plateau. */
export function GameScreen({
  view,
  onDraw,
  onEnd,
  onDiscard,
  onShoot,
  onDodge,
  onAccept,
}: {
  view: GameView
  onDraw: () => void
  onEnd: () => void
  onDiscard: (cardId: string) => void
  onShoot?: (cardId: string, targetSeat: number) => void
  onDodge?: (cardId: string) => void
  onAccept?: () => void
}) {
  return (
    <>
      <p className="bang-turn" role="status">
        {turnHint(view)}
      </p>
      <BangBoard
        view={view}
        onShoot={onShoot}
        onDiscard={onDiscard}
        onDraw={onDraw}
        onEnd={onEnd}
        onDodge={onDodge}
        onAccept={onAccept}
      />
    </>
  )
}
