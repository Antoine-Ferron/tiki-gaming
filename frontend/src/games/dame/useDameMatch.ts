import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, toFormErrors } from '@/lib/api'
import type { FieldErrors } from '@/lib/validation'
import { playMove, readMatch, startMatch } from './api'
import { rememberMatch, savedMatch } from './session'
import type { DameView, Move, Names, Selection } from './types'

type Action = 'start' | 'resume' | 'move'

/** Une requête à la fois ; aucun coup optimiste ni nouvelle création lors d'une actualisation. */
export function useDameMatch() {
  const [view, setView] = useState<DameView | null>(null)
  const [names, setNames] = useState<Names>({ whiteName: '', blackName: '' })
  const [fields, setFields] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Action | null>('resume')
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [setup, setSetup] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)
  const alive = useRef(false)
  const inFlight = useRef(false)

  const receive = useCallback((next: DameView) => {
    setView(next)
    setNames({ whiteName: next.whiteName, blackName: next.blackName })
    setSelection(null)
    setSetup(false)
    setNeedsRefresh(false)
    rememberMatch(next.id)
  }, [])

  const reject = useCallback((err: unknown, kind: Action) => {
    if (kind === 'resume' && err instanceof ApiError && err.status === 404) {
      rememberMatch(null)
      setView(null)
      setSetup(true)
      setNeedsRefresh(false)
      setSelection(null)
      setError('Cette partie n’est plus disponible dans cette session. Commence une nouvelle rencontre.')
      return
    }
    const failure = toFormErrors(err, kind === 'start' ? ['whiteName', 'blackName'] : [])
    setFields(failure.fields)
    setError(
      err instanceof ApiError && err.status === 403
        ? 'Ta session a changé. Recharge la page avant de réessayer.'
        : failure.message,
    )
    if (kind !== 'start') setNeedsRefresh(true)
    setSelection(null)
  }, [])

  const request = useCallback(
    async (kind: Action, operation: () => Promise<DameView>) => {
      if (inFlight.current) return
      inFlight.current = true
      setPending(kind)
      setError(null)
      setFields({})
      try {
        const next = await operation()
        if (alive.current) receive(next)
      } catch (err) {
        if (alive.current) reject(err, kind)
      } finally {
        inFlight.current = false
        if (alive.current) setPending(null)
      }
    },
    [receive, reject],
  )

  useEffect(() => {
    alive.current = true
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const id = savedMatch()
      if (id) void request('resume', () => readMatch(id))
      else setPending(null)
    })
    return () => {
      cancelled = true
      alive.current = false
    }
  }, [request])

  function refresh() {
    const id = view?.id ?? savedMatch()
    if (id) void request('resume', () => readMatch(id))
  }

  function play(move: Move) {
    if (!view || needsRefresh || view.status !== 'IN_PROGRESS') return
    void request('move', () => playMove(view.id, view.version, move))
  }

  return {
    view,
    names,
    setNames,
    fields,
    setFields,
    error,
    pending,
    needsRefresh,
    setup,
    setSetup,
    selection,
    setSelection,
    start: (next: Names) => request('start', () => startMatch(next)),
    refresh,
    play,
  }
}
