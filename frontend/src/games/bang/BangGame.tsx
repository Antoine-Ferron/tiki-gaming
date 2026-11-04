import type { GameProps } from '../types'
import { LocalTable } from './LocalTable'
import { OnlineTable } from './OnlineTable'

/** Sans compte, on joue à quatre sur le même écran ; connecté, on joue en ligne sur les tables du serveur. */
export default function BangGame({ ctx }: GameProps) {
  return ctx.isGuest ? <LocalTable /> : <OnlineTable key={ctx.player!.id} accountId={ctx.player!.id} />
}
