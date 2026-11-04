import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { getGame } from '../game/current'
import { useUiStore } from '../state/uiStore'
import { complete, execute } from '../systems/commands'

/** Durée (ms) pendant laquelle une ligne reste visible quand le chat est fermé. */
const LINE_MS = 7000

function relockPointer() {
  Promise.resolve(document.querySelector('.mini-gta-play canvas')?.requestPointerLock?.()).catch(() => {})
}

/**
 * Chat et commandes (T ou Entrée pour l'ouvrir). Les touches tapées ne remontent pas jusqu'au jeu : elles ne
 * pilotent pas le joueur et ne déclenchent aucun raccourci.
 */
export function Chat() {
  const open = useUiStore((s) => s.menu === 'chat')
  const lines = useUiStore((s) => s.chat)
  const [text, setText] = useState('')
  const [hint, setHint] = useState<string[]>([])
  const [recall, setRecall] = useState(-1)
  const [now, setNow] = useState(() => performance.now())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Fait disparaître les anciennes lignes quand le chat est fermé.
  useEffect(() => {
    if (open || lines.length === 0) return
    const id = setInterval(() => setNow(performance.now()), 500)
    return () => clearInterval(id)
  }, [open, lines.length])

  function close() {
    setText('')
    setHint([])
    setRecall(-1)
    useUiStore.getState().setMenu(null)
    relockPointer()
  }

  function submit() {
    const line = text.trim()
    const ui = useUiStore.getState()
    const game = getGame()
    if (line && game) {
      ui.rememberChat(line)
      ui.addChat(line, 'self')
      if (line.startsWith('/')) {
        const r = execute(game, line)
        ui.addChat(r.message, r.ok ? 'ok' : 'error')
      }
    }
    setNow(performance.now())
    close()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Le jeu écoute le clavier sur window : on garde les touches tapées pour le chat.
    e.stopPropagation()
    const history = useUiStore.getState().chatHistory
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const r = complete(text)
      setText(r.text)
      setHint(r.options)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (history.length === 0) return
      const next =
        e.key === 'ArrowUp' ? (recall < 0 ? history.length - 1 : Math.max(0, recall - 1)) : recall < 0 ? -1 : recall + 1
      if (next < 0 || next >= history.length) {
        setRecall(-1)
        setText('')
      } else {
        setRecall(next)
        setText(history[next])
      }
    }
  }

  const visible = open ? lines.slice(-10) : lines.filter((l) => now - l.at < LINE_MS).slice(-6)

  return (
    <div className="mini-gta-chat">
      {visible.length > 0 && (
        <ul className="mini-gta-chat-lines" aria-live="polite">
          {visible.map((l) => (
            <li key={l.id} className={`mini-gta-chat-${l.kind}`}>
              {l.kind === 'self' ? `> ${l.text}` : l.text}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <>
          {hint.length > 0 && <p className="mini-gta-chat-hint">{hint.join(' · ')}</p>}
          <input
            ref={inputRef}
            className="mini-gta-chat-input"
            aria-label="Chat et commandes"
            placeholder="Message ou commande (/aide)"
            value={text}
            maxLength={120}
            onChange={(e) => {
              setText(e.target.value)
              setHint([])
            }}
            onKeyDown={onKeyDown}
          />
        </>
      )}
    </div>
  )
}
