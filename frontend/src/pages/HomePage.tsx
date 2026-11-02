import { Link } from 'react-router'
import { games } from '@/games/registry'
import { useAuth } from '@/auth/AuthContext'
import { GameTags } from '@/components/GameTags'

export default function HomePage() {
  const { profile } = useAuth()

  return (
    <>
      <section className="hero">
        <h1>{profile ? `Salut ${profile.username} 👋` : 'Bienvenue sur Tiki Gaming'}</h1>
        <p className="muted">Choisis un jeu. Tes scores et sauvegardes sont liés à ton compte.</p>
      </section>
      <section className="grid">
        {games.map((game) => (
          <Link key={game.slug} to={`/games/${game.slug}`} className="card game-card">
            {game.thumbnail && <img src={game.thumbnail} alt="" />}
            <h2>{game.title}</h2>
            <GameTags game={game} />
            <p className="muted">{game.description}</p>
          </Link>
        ))}
      </section>
    </>
  )
}
