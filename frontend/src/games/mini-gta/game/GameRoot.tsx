import { useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'
import { useFrame, useThree } from '@react-three/fiber'
import {
  ACESFilmicToneMapping,
  NoToneMapping,
  type PerspectiveCamera,
  type ToneMapping,
  type WebGLRenderer,
} from 'three'
import { gameLoop } from '../core/loop'
import { input } from '../core/input'
import { Game } from './Game'
import { setGame } from './current'
import { useUiStore } from '../state/uiStore'
import { applySettings, useSettingsStore } from '../state/settingsStore'

/** Avec le post-FX, c'est l'effet ACES qui fait le tone mapping. */
function setToneMapping(gl: WebGLRenderer, mapping: ToneMapping) {
  gl.toneMapping = mapping
}

/** Creates the Game, drives the fixed-step loop from R3F's frame loop, handles global keys. */
export function GameRoot() {
  const { scene, camera, gl } = useThree()
  const gameRef = useRef<Game | null>(null)
  const postfx = useSettingsStore((s) => s.postfx)

  useEffect(() => setToneMapping(gl, postfx ? NoToneMapping : ACESFilmicToneMapping), [gl, postfx])

  useEffect(() => {
    const detach = input.attach(gl.domElement)
    const game = new Game(scene, camera as PerspectiveCamera, gl)
    let cancelled = false
    applySettings(useSettingsStore.getState())
    const unsubSettings = useSettingsStore.subscribe((s) => {
      applySettings(s)
      game.env?.applyShadowQuality()
    })
    game
      .init((text, progress) => useUiStore.setState({ loading: { text, progress } }))
      .then(() => {
        if (cancelled) return
        gameRef.current = game
        setGame(game)
        // Outil de vérification en développement uniquement (absent du build de production).
        if (import.meta.env.DEV) (window as unknown as { __miniGta?: Game }).__miniGta = game
        game.events.on('notify', (n) => useUiStore.getState().notify(n.text, n.kind))
        useUiStore.setState({ loading: null })
      })
      .catch((err) => {
        logger.error({ err }, 'Chargement de MiniGTA impossible')
        useUiStore.setState({ loading: null, loadError: (err as Error).message })
      })
    const system = {
      name: 'game',
      update: (dt: number) => {
        gameRef.current?.update(dt)
        input.endTick()
      },
      render: (alpha: number, dt: number) => gameRef.current?.render(alpha, dt),
    }
    const off = gameLoop.add(system)
    const onLock = () => {
      const s = useUiStore.getState()
      if (!input.pointerLocked && s.started && s.menu === null) s.setMenu('pause')
    }
    document.addEventListener('pointerlockchange', onLock)
    return () => {
      cancelled = true
      off()
      detach()
      unsubSettings()
      document.removeEventListener('pointerlockchange', onLock)
      gameRef.current = null
      setGame(null)
      // init may still be running: dispose once it has finished.
      if (game.player) game.dispose()
    }
  }, [scene, camera, gl])

  useFrame((_, delta) => {
    const game = gameRef.current
    const ui = useUiStore.getState()
    if (game) {
      const blocking = !ui.started || (ui.menu !== null && ui.menu !== 'wheel')
      game.ui.blocking = blocking || ui.menu === 'wheel'
      gameLoop.paused = blocking
      gameLoop.timeScale = ui.menu === 'wheel' ? 0.25 : 1
      input.lockOnClick = ui.started && ui.menu === null
      if (ui.started) {
        // Chat (T ou Entrée) : tant qu'il est ouvert, les touches tapées ne sont pas des raccourcis.
        if ((input.wasPressedThisFrame('KeyT') || input.wasPressedThisFrame('Enter')) && ui.menu === null) {
          ui.setMenu('chat')
        }
        const chat = useUiStore.getState().menu === 'chat'
        if (!chat && input.wasPressedThisFrame('KeyM')) ui.setMenu(ui.menu === 'map' ? null : 'map')
        if (!chat && input.wasPressedThisFrame('KeyP')) ui.setMenu(ui.menu === 'pause' ? null : 'pause')
        if (input.wasPressedThisFrame('Tab') && ui.menu === null && game.player.state === 'foot') ui.setMenu('wheel')
        if (ui.menu === 'wheel' && !input.isDown('Tab')) ui.setMenu(null)
      }
    }
    gameLoop.advance(delta)
    input.endFrame()
    ui.prune(performance.now())
  })

  return null
}
