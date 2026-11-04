import { Link, useLocation, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { CursorSwarm } from '@/components/CursorSwarm'
import { FilterChips } from '@/components/FilterChips'
import { GameTags } from '@/components/GameTags'
import { GAME_CATEGORIES } from '@/games/categories'
import { filterGames, parseCatalogFilter } from '@/games/domain/catalog'
import { games } from '@/games/registry'
import { GAME_THEMES } from '@/games/themes'

export default function HomePage() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const accountDeleted = (useLocation().state as { accountDeleted?: boolean } | null)?.accountDeleted === true
  const filter = parseCatalogFilter(params)
  const shown = filterGames(games, filter)

  function choose(param: 'categorie' | 'theme', value?: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(param, value)
    else next.delete(param)
    setParams(next, { replace: true })
  }

  return (
    <div className="lobby">
      <CursorSwarm />
      <h1>{profile ? `Salut ${profile.username} 👋` : 'Bienvenue sur Tiki Gaming'}</h1>
      {accountDeleted && (
        <p className="success" role="status">
          Ton compte et toutes tes données ont été supprimés.
        </p>
      )}
      <div className="filters">
        <FilterChips
          label="Catégorie"
          choices={GAME_CATEGORIES}
          value={filter.category}
          onChange={(v) => choose('categorie', v)}
        />
        <FilterChips label="Thème" choices={GAME_THEMES} value={filter.theme} onChange={(v) => choose('theme', v)} />
      </div>
      {shown.length === 0 ? (
        <p className="muted" role="status">
          Aucun jeu ne correspond à ces filtres.
        </p>
      ) : (
        <section className="grid">
          {shown.map((game) => (
            <Link key={game.slug} to={`/games/${game.slug}`} className={`card game-card game-card-${game.category}`}>
              {game.thumbnail ? (
                <img src={game.thumbnail} alt="" />
              ) : (
                <div className="game-card-cover" aria-hidden="true">
                  {game.title[0]}
                </div>
              )}
              <h2>{game.title}</h2>
              <GameTags game={game} />
              <p className="muted">{game.description}</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
