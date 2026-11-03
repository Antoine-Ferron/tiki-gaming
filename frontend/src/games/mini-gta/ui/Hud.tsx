import { useHudStore } from '../state/hudStore'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { Minimap } from './Minimap'
import { formatMoney } from '../domain/format'

function Stars({ count, flashing }: { count: number; flashing: boolean }) {
  return (
    <div className={`mini-gta-stars ${flashing ? 'mini-gta-flashing' : ''}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= count ? 'mini-gta-on' : 'mini-gta-off'}>
          ★
        </span>
      ))}
    </div>
  )
}

function Notifications() {
  const list = useUiStore((s) => s.notifications)
  const big = list.filter((n) => n.kind === 'big').slice(-1)
  const small = list.filter((n) => n.kind !== 'big')
  return (
    <>
      {big.map((n) => (
        <div
          key={n.id}
          className={`mini-gta-big-text ${n.text === 'K.O.' || n.text === 'ARRÊTÉ' ? 'mini-gta-death' : ''}`}
        >
          {n.text}
        </div>
      ))}
      <div className="mini-gta-toasts">
        {small.map((n) => (
          <div key={n.id} className={`mini-gta-toast mini-gta-${n.kind}`}>
            {n.text}
          </div>
        ))}
      </div>
    </>
  )
}

function formatTime(h: number) {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function Hud() {
  const h = useHudStore()
  const money = useGameStore((s) => s.money)
  const started = useUiStore((s) => s.started)
  const menu = useUiStore((s) => s.menu)
  if (!h.ready || !started) return null
  const showCross = h.aiming && h.weapon !== 'sniper'
  return (
    <div className="mini-gta-hud">
      <div className="mini-gta-bottom-left">
        <Minimap />
        <div className="mini-gta-bars">
          <div className="mini-gta-bar mini-gta-health">
            <div style={{ width: `${(h.health / h.maxHealth) * 100}%` }} />
          </div>
          <div className="mini-gta-bar mini-gta-armor">
            <div style={{ width: `${Math.min(100, h.armor)}%` }} />
          </div>
        </div>
      </div>
      <div className="mini-gta-top-right">
        <div className="mini-gta-clock">{formatTime(h.hours)}</div>
        <div className="mini-gta-weapon">
          <span className="mini-gta-weapon-name">{h.weaponLabel}</span>
          {h.weapon !== 'fists' && h.weapon !== 'bat' && (
            <span className="mini-gta-ammo">
              {h.weapon === 'grenade' ? h.ammo : `${h.clip} / ${h.ammo}`}
              {h.reloading && ' ⟳'}
            </span>
          )}
        </div>
        <div className="mini-gta-money">{formatMoney(money)}</div>
        <Stars count={h.wanted} flashing={h.wantedFlashing} />
      </div>
      {h.inVehicle && (
        <div className="mini-gta-speedo">
          <div className="mini-gta-speed">
            {h.speedKmh}
            <small> km/h</small>
          </div>
          {h.altitude > 8 && <div className="mini-gta-alt">Alt. {h.altitude} m</div>}
          <div className="mini-gta-vname">{h.vehicleLabel}</div>
          <div className="mini-gta-bar mini-gta-vhealth">
            <div style={{ width: `${h.vehicleHealth * 100}%` }} />
          </div>
        </div>
      )}
      {h.mission && (
        <div className="mini-gta-mission">
          <div className="mini-gta-objective">{h.mission.objective}</div>
          {h.mission.timer !== null && (
            <div className={`mini-gta-timer ${h.mission.timer < 15 ? 'mini-gta-urgent' : ''}`}>
              {Math.ceil(h.mission.timer)} s
            </div>
          )}
        </div>
      )}
      {h.prompt && menu === null && <div className="mini-gta-prompt">{h.prompt}</div>}
      {showCross && <div className="mini-gta-crosshair" />}
      {h.aiming && h.weapon === 'sniper' && <div className="mini-gta-scope" />}
      <Notifications />
    </div>
  )
}
