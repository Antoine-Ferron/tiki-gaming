import { Suspense, useMemo } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { getGame } from '@/games/registry'
import { createGameContext } from '@/games/sdk'
import NotFoundPage from './NotFoundPage'

export default function GamePage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { user, profile, loading } = useAuth()
  const game = getGame(slug)

  // Connecté : on attend le profil. Invité : contexte local.
  const ready = !loading && (!user || !!profile)
  const ctx = useMemo(
    () => (game && ready ? createGameContext(game.slug, profile ? { id: profile.id, username: profile.username } : null) : null),
    [game, ready, profile],
  )

  if (!game) return <NotFoundPage />
  if (!loading && !user && game.mode !== 'solo') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!ctx) return <p className="muted">Chargement…</p>

  const GameComponent = game.component
  return (
    <div className="game-page">
      <p><Link to="/">← Tous les jeux</Link></p>
      <h1>{game.title}</h1>
      {ctx.isGuest && (
        <p className="notice">
          Tu joues en invité : ta progression reste sur cet appareil et tes scores ne sont pas classés.{' '}
          <Link to="/login" state={{ from: location.pathname }}>Se connecter</Link>
        </p>
      )}
      <Suspense fallback={<p className="muted">Chargement du jeu…</p>}>
        <GameComponent ctx={ctx} />
      </Suspense>
    </div>
  )
}
