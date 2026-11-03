import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NoToneMapping, PCFShadowMap } from 'three'
import type { GameContext } from '../types'
import type { MiniGtaSave } from './domain/save'
import { GameRoot } from './game/GameRoot'
import { PostFX } from './render/PostFX'
import { bindSession, progressOf, useGameStore } from './state/gameStore'
import { useHudStore } from './state/hudStore'
import { createProgressSession } from './state/session'
import { useSettingsStore } from './state/settingsStore'
import { useUiStore } from './state/uiStore'
import { Hud } from './ui/Hud'
import { FullscreenButton } from './ui/FullscreenButton'
import { Menus } from './ui/Menus'
import { loadMapColors } from './ui/palette'

type Props = {
  ctx: GameContext
  save: MiniGtaSave
  /** Meilleur score déjà enregistré pour ce joueur (null en invité ou sans score). */
  best: number | null
  onExit(progress: MiniGtaSave): void
}

/**
 * Partie, dans la page ou en plein écran : branche la progression sur le GameContext (ctx.save, ctx.submitScore),
 * monte le rendu Three.js et rend la main à l'écran d'accueil quand le joueur quitte.
 */
export default function MiniGtaPlay({ ctx, save, best, onExit }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  // Progression et interface remises à zéro avant le premier rendu du moteur.
  useState(() => {
    useUiStore.getState().reset()
    useGameStore.getState().load(save)
    return true
  })
  const postfx = useSettingsStore((s) => s.postfx)
  const resolution = useSettingsStore((s) => s.resolution)
  const shadows = useSettingsStore((s) => s.shadows)
  const state = useHudStore((s) => s.state)
  const grayscale = state === 'dead' || state === 'busted'

  useLayoutEffect(() => {
    if (rootRef.current) loadMapColors(rootRef.current)
    bindSession(createProgressSession(ctx, best, (message) => useUiStore.getState().notify(message, 'fail')))
    useUiStore.setState({ exit: () => onExit(progressOf(useGameStore.getState())) })
    return () => {
      bindSession(null)
      useUiStore.setState({ exit: null })
    }
    // La partie démarre une seule fois avec la sauvegarde reçue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fermer la page en pleine partie sauvegarde la progression connue.
  useEffect(() => {
    const onHide = () => void ctx.save(progressOf(useGameStore.getState())).catch(() => {})
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [ctx])

  return (
    <>
      <div className="mini-gta-play" ref={rootRef}>
        <Canvas
          className={grayscale ? 'mini-gta-canvas mini-gta-grayscale' : 'mini-gta-canvas'}
          shadows={shadows !== 'off' ? { type: PCFShadowMap } : false}
          dpr={[Math.min(1, resolution), Math.min(2, resolution * 1.5)]}
          gl={{ antialias: !postfx, powerPreference: 'high-performance', toneMapping: NoToneMapping }}
          camera={{ fov: 62, near: 0.1, far: 2000, position: [0, 5, 10] }}
        >
          <GameRoot />
          {postfx && <PostFX />}
        </Canvas>
        <Hud />
        <Menus />
      </div>
      <div className="mini-gta-toolbar">
        <FullscreenButton target={rootRef} />
        <span className="muted">Clique dans le jeu pour diriger la caméra · Échap : pause</span>
      </div>
    </>
  )
}
