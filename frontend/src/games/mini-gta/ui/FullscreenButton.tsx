import { useEffect, useState, type RefObject } from 'react'

/** Met la zone de jeu (et non toute la page) en plein écran ; Échap ou le bouton en sortent. */
export function FullscreenButton({ target }: { target: RefObject<HTMLElement | null> }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement && document.fullscreenElement === target.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [target])

  function toggle() {
    // Un refus du navigateur n'empêche pas de jouer dans la page.
    if (active) document.exitFullscreen().catch(() => {})
    else target.current?.requestFullscreen().catch(() => {})
  }

  return (
    <button className="small" onClick={toggle}>
      {active ? 'Quitter le plein écran' : 'Plein écran'}
    </button>
  )
}
