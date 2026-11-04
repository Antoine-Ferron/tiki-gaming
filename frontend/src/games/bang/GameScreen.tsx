import { useState } from 'react'
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
  // Le prototype local ne dispose pas encore des règles de tir du serveur.
  const [shotNotice, setShotNotice] = useState(false)

  return (
    <>
      <p className="bang-turn" role="status">
        {turnHint(view)}
      </p>
      {shotNotice && (
        <p className="muted" role="note">
          Le tir n'est pas encore disponible.
        </p>
      )}
      <BangBoard
        view={view}
        onShoot={onShoot ?? (() => setShotNotice(true))}
        onDiscard={onDiscard}
        onDraw={onDraw}
        onEnd={onEnd}
        onDodge={onDodge}
        onAccept={onAccept}
      />
    </>
  )
}
