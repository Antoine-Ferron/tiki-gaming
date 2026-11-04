import { GAME_CATEGORIES } from '@/games/categories'
import { GAME_THEMES } from '@/games/themes'
import type { GameDefinition } from '@/games/types'

export function GameTags({ game }: { game: GameDefinition }) {
  const category = GAME_CATEGORIES[game.category]
  return (
    <div className="tags">
      <span className={`tag tag-${game.category}`} title={category.players}>
        {category.label}
      </span>
      <span className="tag">{GAME_THEMES[game.theme].label}</span>
      <span className="tag">{game.mode === 'solo' ? 'Sans compte' : 'Compte requis'}</span>
    </div>
  )
}
