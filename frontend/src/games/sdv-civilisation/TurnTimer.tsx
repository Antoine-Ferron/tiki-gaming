import { useEffect, useRef, useState } from 'react'
import { formatRemaining, turnPhase } from './turnCountdown'

/**
 * Compte à rebours du tour, à partir du temps restant annoncé par le serveur. À zéro, `onExpire` redemande la
 * partie au serveur, qui a alors défaussé une carte au hasard. Remonté à chaque réponse du serveur (clé).
 */
export function TurnTimer({ remainingMs, onExpire }: { remainingMs: number; onExpire: () => void }) {
  const [end] = useState(() => Date.now() + remainingMs)
  const [left, setLeft] = useState(remainingMs)
  const expire = useRef(onExpire)

  useEffect(() => {
    expire.current = onExpire
  })

  useEffect(() => {
    const id = setInterval(() => {
      const rest = Math.max(0, end - Date.now())
      setLeft(rest)
      if (rest === 0) {
        clearInterval(id)
        expire.current()
      }
    }, 250)
    return () => clearInterval(id)
  }, [end])

  const text = formatRemaining(left)
  return (
    <span
      role="timer"
      aria-label={`Temps restant pour jouer : ${text}`}
      className={`sdv-civilisation-timer sdv-civilisation-timer-${turnPhase(left)}`}
    >
      {text}
    </span>
  )
}
