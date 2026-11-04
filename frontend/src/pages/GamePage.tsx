import { Suspense, useMemo } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { GameTags } from '@/components/GameTags'
import { platformDeps } from '@/games/adapters'
import { gameAccess } from '@/games/domain/access'
import { GameErrorBoundary } from '@/games/GameErrorBoundary'
import { getGame } from '@/games/registry'
import { createGameContext } from '@/games/sdk'
import NotFoundPage from './NotFoundPage'

export default function GamePage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { user, profile, loading } = useAuth()
  const game = getGame(slug)

  const access = gameAccess({
    gameExists: !!game,
    mode: game?.mode ?? 'solo',
    authLoading: loading,
    loggedIn: !!user,
    profileLoaded: !!profile,
  })
  const playable = access === 'guest' || access === 'player'
  // Dépend de id/username (primitifs), pas de `profile` : une mise à jour du profil qui ne change ni l'un ni
  // l'autre (ex. avatar) ne doit pas recréer `ctx` et, avec lui, abandonner une connexion temps réel ouverte.
  const player = useMemo(
    () => (access === 'player' && profile ? { id: profile.id, username: profile.username } : null),
    // profile volontairement réduit à ses champs : une autre partie du profil qui change ne doit pas recréer ctx
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [access, profile?.id, profile?.username],
  )
  const ctx = useMemo(
    () => (game && playable ? createGameContext(game, player, platformDeps()) : null),
    [game, playable, player],
  )

  if (access === 'not-found' || !game) return <NotFoundPage />
  if (access === 'login') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!ctx) return <p className="muted">Chargement…</p>

  const GameComponent = game.component
  return (
    <div className="game-page">
      <p>
        <Link to="/">← Tous les jeux</Link>
      </p>
      <h1>{game.title}</h1>
      <GameTags game={game} />
      {ctx.isGuest && (
        <p className="notice">
          Tu joues en invité : ta progression reste sur cet appareil et tes scores ne sont pas classés.{' '}
          <Link to="/login" state={{ from: location.pathname }}>
            Se connecter
          </Link>
        </p>
      )}
      <GameErrorBoundary key={game.slug} gameSlug={game.slug}>
        <Suspense fallback={<p className="muted">Chargement du jeu…</p>}>
          <GameComponent ctx={ctx} />
        </Suspense>
      </GameErrorBoundary>
    </div>
  )
}
