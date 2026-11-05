import { useState } from 'react'
import type { GameProps } from '../types'
import { LocalTable } from './LocalTable'
import { OnlineTable } from './OnlineTable'

export default function BangGame({ ctx }: GameProps) {
  const [mode, setMode] = useState<'local' | 'online'>(() => {
    try {
      const saved = sessionStorage.getItem('tiki:bang:mode')
      if (saved === 'local' || saved === 'online') return saved
    } catch {
      // Le choix reste disponible lorsque le navigateur refuse le stockage.
    }
    return ctx.isGuest ? 'local' : 'online'
  })

  function choose(next: typeof mode) {
    setMode(next)
    try {
      sessionStorage.setItem('tiki:bang:mode', next)
    } catch {
      // Le choix reste valable pour cette ouverture du jeu.
    }
  }

  const playerId = ctx.player?.id ?? 'guest'
  return (
    <>
      <div role="group" aria-label="Mode de jeu">
        <button type="button" aria-pressed={mode === 'local'} onClick={() => choose('local')}>
          Sur le même écran
        </button>
        <button type="button" aria-pressed={mode === 'online'} onClick={() => choose('online')}>
          En ligne
        </button>
      </div>
      {mode === 'local' ? <LocalTable /> : <OnlineTable key={playerId} accountId={playerId} />}
    </>
  )
}
