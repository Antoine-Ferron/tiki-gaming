import { useEffect, useRef, useState } from 'react'
import { input } from '../core/input'
import { getGame } from '../game/current'
import { useGameStore } from '../state/gameStore'
import { saveGame } from '../state/save'
import { useHudStore } from '../state/hudStore'
import { DEFAULT_SETTINGS, useSettingsStore, type ShadowQuality } from '../state/settingsStore'
import { useUiStore } from '../state/uiStore'
import { addWeapon, slotOf, WEAPONS, WEAPON_ORDER, type WeaponId } from '../systems/weapons'
import { mapImage, MAP_PX, toMap } from './mapImage'
import { MAP_HALF, MAP_SIZE } from '../world/constants'
import { mapColors } from './palette'
import { formatMoney } from '../domain/format'

function lockPointer() {
  // Le navigateur peut refuser le verrouillage (fenêtre sans focus) : on reste simplement sans.
  Promise.resolve(document.querySelector('canvas')?.requestPointerLock?.()).catch(() => {})
}

function close() {
  useUiStore.getState().setMenu(null)
  lockPointer()
}

const k = (code: string) => input.label(code)

function Controls() {
  const rows: [string, string][] = [
    [`${k('KeyW')} ${k('KeyA')} ${k('KeyS')} ${k('KeyD')}`, 'Se déplacer / conduire'],
    ['Souris', 'Caméra'],
    [k('ShiftLeft'), 'Sprint (hélico : monter, avion : gaz +)'],
    ['Espace', 'Sauter / frein à main'],
    [k('KeyC'), 'S’accroupir'],
    [k('KeyF'), 'Entrer / sortir / voler un véhicule'],
    [k('KeyE'), 'Interagir (missions, armurerie, sauvegarde)'],
    ['Clic droit', 'Viser'],
    ['Clic gauche', 'Tirer / frapper / lancer'],
    [k('KeyR'), 'Recharger'],
    ['Molette · 1-7', 'Changer d’arme'],
    ['Tab (maintenir)', 'Roue des armes'],
    [k('KeyH'), 'Sirène (véhicule de police)'],
    [`${k('KeyQ')} / ${k('KeyE')}`, 'Hélico : roulis · Avion : lacet'],
    ['Ctrl', 'Hélico : descendre · Avion : gaz −'],
    [k('KeyM'), 'Carte'],
    [`${k('KeyT')} · Entrée`, 'Chat et commandes (/aide)'],
    [`Échap · ${k('KeyP')}`, 'Pause'],
    ['F5', 'Sauvegarde rapide'],
  ]
  return (
    <table className="mini-gta-controls">
      <tbody>
        {rows.map(([key, what]) => (
          <tr key={what}>
            <td className="mini-gta-key">{key}</td>
            <td>{what}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function quit() {
  const game = getGame()
  const exit = useUiStore.getState().exit
  if (document.pointerLockElement) document.exitPointerLock()
  // La sauvegarde part avant de quitter ; son échec est signalé mais ne bloque pas la sortie.
  void (game ? saveGame(game) : Promise.resolve()).finally(() => exit?.())
}

function StartScreen() {
  const loading = useUiStore((s) => s.loading)
  const error = useUiStore((s) => s.loadError)
  const [help, setHelp] = useState(false)
  return (
    <div className="mini-gta-overlay mini-gta-start">
      <h1>MiniGTA</h1>
      {error ? (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          <button onClick={() => useUiStore.getState().exit?.()}>Quitter</button>
        </>
      ) : loading ? (
        <div className="mini-gta-loading" role="status">
          <div className="mini-gta-progress">
            <div style={{ width: `${loading.progress * 100}%` }} />
          </div>
          <p className="muted">{loading.text}</p>
        </div>
      ) : (
        <>
          <button
            className="big"
            onClick={() => {
              useUiStore.setState({ started: true, menu: null })
              lockPointer()
            }}
          >
            Entrer en ville
          </button>
          <button className="link" onClick={() => setHelp(!help)}>
            {help ? 'Masquer les commandes' : 'Voir les commandes'}
          </button>
          {help && <Controls />}
          <p className="mini-gta-hint">
            Les missions sont signalées par un M jaune sur la minimap. Ta planque est le ⌂ vert.
          </p>
        </>
      )}
    </div>
  )
}

function Settings() {
  const s = useSettingsStore()
  return (
    <div className="mini-gta-settings">
      <label>
        Ombres
        <select value={s.shadows} onChange={(e) => s.set({ shadows: e.target.value as ShadowQuality })}>
          <option value="off">Désactivées</option>
          <option value="low">Basses</option>
          <option value="high">Hautes</option>
        </select>
      </label>
      <label>
        Post-traitement (bloom, AA)
        <input type="checkbox" checked={s.postfx} onChange={(e) => s.set({ postfx: e.target.checked })} />
      </label>
      <label>
        Résolution ({Math.round(s.resolution * 100)}%)
        <input
          type="range"
          min={0.5}
          max={1}
          step={0.05}
          value={s.resolution}
          onChange={(e) => s.set({ resolution: +e.target.value })}
        />
      </label>
      <label>
        Distance d’affichage ({s.viewDistance} m)
        <input
          type="range"
          min={300}
          max={1000}
          step={50}
          value={s.viewDistance}
          onChange={(e) => s.set({ viewDistance: +e.target.value })}
        />
      </label>
      <label>
        Densité du trafic ({s.trafficDensity})
        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={s.trafficDensity}
          onChange={(e) => s.set({ trafficDensity: +e.target.value })}
        />
      </label>
      <label>
        Densité des piétons ({s.pedestrianDensity})
        <input
          type="range"
          min={0}
          max={80}
          step={1}
          value={s.pedestrianDensity}
          onChange={(e) => s.set({ pedestrianDensity: +e.target.value })}
        />
      </label>
      <label>
        Sensibilité souris ({s.sensitivity.toFixed(2)})
        <input
          type="range"
          min={0.3}
          max={3}
          step={0.05}
          value={s.sensitivity}
          onChange={(e) => s.set({ sensitivity: +e.target.value })}
        />
      </label>
      <label>
        Inverser l’axe Y
        <input type="checkbox" checked={s.invertY} onChange={(e) => s.set({ invertY: e.target.checked })} />
      </label>
      <button onClick={() => s.set(DEFAULT_SETTINGS)}>Valeurs par défaut</button>
    </div>
  )
}

function PauseMenu() {
  const [tab, setTab] = useState<'main' | 'settings' | 'controls'>('main')
  const completed = useGameStore((s) => s.completedMissions.length)
  const [confirmReset, setConfirmReset] = useState(false)
  return (
    <div className="mini-gta-overlay mini-gta-pause">
      <h2>Pause</h2>
      <div className="mini-gta-tabs">
        <button className={tab === 'main' ? 'mini-gta-active' : ''} onClick={() => setTab('main')}>
          Jeu
        </button>
        <button className={tab === 'settings' ? 'mini-gta-active' : ''} onClick={() => setTab('settings')}>
          Réglages
        </button>
        <button className={tab === 'controls' ? 'mini-gta-active' : ''} onClick={() => setTab('controls')}>
          Commandes
        </button>
      </div>
      {tab === 'main' && (
        <div className="mini-gta-menu-col">
          <button onClick={close}>Reprendre</button>
          <p>Missions terminées : {completed} / 4</p>
          <button onClick={quit}>Quitter</button>
          {confirmReset ? (
            <p role="alert">
              Effacer ta progression et recommencer ?{' '}
              <button className="link" onClick={() => void useGameStore.getState().reset().then(quit)}>
                Oui, recommencer
              </button>{' '}
              <button className="link" onClick={() => setConfirmReset(false)}>
                Annuler
              </button>
            </p>
          ) : (
            <button className="link" onClick={() => setConfirmReset(true)}>
              Nouvelle partie
            </button>
          )}
        </div>
      )}
      {tab === 'settings' && <Settings />}
      {tab === 'controls' && <Controls />}
    </div>
  )
}

function FullMap() {
  const ref = useRef<HTMLCanvasElement>(null)
  const waypoint = useUiStore((s) => s.waypoint)
  useEffect(() => {
    const game = getGame()
    const canvas = ref.current
    if (!game || !canvas) return
    const ctx = canvas.getContext('2d')!
    const size = canvas.width
    const s = size / MAP_PX
    ctx.drawImage(mapImage(game.city), 0, 0, size, size)
    const mark = (x: number, z: number, color: string, label: string) => {
      const m = toMap(x, z)
      ctx.fillStyle = color
      ctx.strokeStyle = mapColors.outline
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(m.x * s, m.y * s, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = mapColors.player
      ctx.font = 'bold 12px system-ui'
      ctx.fillText(label, m.x * s + 10, m.y * s + 4)
    }
    const L = game.city.locations
    mark(L.safehouseDoor.x, L.safehouseDoor.z, mapColors.safehouse, 'Planque')
    mark(L.gunshopDoor.x, L.gunshopDoor.z, mapColors.gunshop, 'Armurerie')
    mark(L.hospital.x, L.hospital.z, mapColors.hospital, 'Hôpital')
    mark(L.policeStation.x, L.policeStation.z, mapColors.police, 'Commissariat')
    mark(L.heliSpawn.x, L.heliSpawn.z, mapColors.airfield, 'Aérodrome')
    for (const d of game.missions.available()) mark(d.giver.x, d.giver.z, mapColors.mission, d.title)
    if (waypoint) mark(waypoint.x, waypoint.z, mapColors.waypoint, 'Repère')
    const p = game.player.position
    mark(p.x, p.z, mapColors.player, 'Toi')
  }, [waypoint])
  return (
    <div className="mini-gta-overlay mini-gta-map">
      <canvas
        ref={ref}
        width={760}
        height={760}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = ((e.clientX - r.left) / r.width) * MAP_SIZE - MAP_HALF
          const z = ((e.clientY - r.top) / r.height) * MAP_SIZE - MAP_HALF
          useUiStore.setState({ waypoint: { x, z } })
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          useUiStore.setState({ waypoint: null })
        }}
      />
      <p className="mini-gta-hint">Clic : placer un repère GPS · Clic droit : l’effacer · {k('KeyM')} : fermer</p>
      <button className="link" onClick={close}>
        Fermer la carte
      </button>
    </div>
  )
}

function Shop() {
  const money = useGameStore((s) => s.money)
  const [, force] = useState(0)
  const game = getGame()
  if (!game) return null
  const inv = game.player.inventory
  /** Achat validé et débité par le serveur ; seul l'effet en jeu est appliqué localement. */
  const buy = (item: 'weapon' | 'ammo' | 'armor', id?: WeaponId) => {
    useGameStore
      .getState()
      .purchase(item, id)
      .then((r) => {
        if (!r.ok) return
        if (item === 'armor') game.player.actor.armor = 100
        else addWeapon(inv, id!, r.rounds)
        force((n) => n + 1)
      })
      .catch((err: Error) => useUiStore.getState().notify(err.message, 'fail'))
  }
  const items = WEAPON_ORDER.filter((id) => id !== 'fists')
  return (
    <div className="mini-gta-overlay mini-gta-shop">
      <h2>Armurerie</h2>
      <p className="mini-gta-money">{formatMoney(money)}</p>
      <table>
        <tbody>
          {items.map((id) => {
            const w = WEAPONS[id]
            const owned = slotOf(inv, id)
            return (
              <tr key={id}>
                <td>{w.label}</td>
                <td>{owned ? (w.melee ? 'Possédé' : `${owned.clip + owned.ammo} munitions`) : ''}</td>
                <td>
                  {!owned ? (
                    <button disabled={money < w.price} onClick={() => buy('weapon', id)}>
                      Acheter · {formatMoney(w.price)}
                    </button>
                  ) : !w.melee ? (
                    <button disabled={money < w.ammoPrice} onClick={() => buy('ammo', id)}>
                      +{w.ammoPack} · {formatMoney(w.ammoPrice)}
                    </button>
                  ) : null}
                </td>
              </tr>
            )
          })}
          <tr>
            <td>Gilet pare-balles</td>
            <td>{Math.round(game.player.actor.armor)} / 100</td>
            <td>
              <button disabled={money < 250 || game.player.actor.armor >= 100} onClick={() => buy('armor')}>
                Acheter · {formatMoney(250)}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <button onClick={close}>Fermer</button>
    </div>
  )
}

function WeaponWheel() {
  const owned = useHudStore((s) => s.owned)
  const current = useHudStore((s) => s.weapon)
  const [selected, setSelected] = useState<WeaponId>(current)
  const selectedRef = useRef(selected)
  useEffect(() => {
    const game = getGame()
    if (!game) return
    game.ui.cursor.x = 0
    game.ui.cursor.y = 0
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const c = game.ui.cursor
      if (Math.hypot(c.x, c.y) < 25) return
      const angle = Math.atan2(c.y, c.x)
      const n = WEAPON_ORDER.length
      const idx = Math.round(((angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / n)) % n
      const id = WEAPON_ORDER[idx]
      if (owned.includes(id) && id !== selectedRef.current) {
        selectedRef.current = id
        setSelected(id)
      }
      const len = Math.hypot(c.x, c.y)
      if (len > 150) {
        c.x = (c.x / len) * 150
        c.y = (c.y / len) * 150
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (owned.includes(selectedRef.current)) game.combat.select(selectedRef.current)
    }
  }, [owned])
  const n = WEAPON_ORDER.length
  return (
    <div className="mini-gta-wheel">
      {WEAPON_ORDER.map((id, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2
        const has = owned.includes(id)
        return (
          <div
            key={id}
            className={`mini-gta-slot ${has ? '' : 'mini-gta-empty'} ${selected === id ? 'mini-gta-selected' : ''}`}
            style={{ transform: `translate(${Math.cos(a) * 150}px, ${Math.sin(a) * 150}px)` }}
          >
            {WEAPONS[id].label}
          </div>
        )
      })}
      <div className="mini-gta-center">{WEAPONS[selected].label}</div>
    </div>
  )
}

export function Menus() {
  const menu = useUiStore((s) => s.menu)
  const started = useUiStore((s) => s.started)
  useEffect(() => {
    if (menu && menu !== 'wheel' && document.pointerLockElement) document.exitPointerLock()
  }, [menu])
  if (!started) return <StartScreen />
  if (menu === 'pause') return <PauseMenu />
  if (menu === 'map') return <FullMap />
  if (menu === 'shop') return <Shop />
  if (menu === 'wheel') return <WeaponWheel />
  return null
}
