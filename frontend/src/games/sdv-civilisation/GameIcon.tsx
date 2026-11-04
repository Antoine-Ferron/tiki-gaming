import type { ReactNode } from 'react'

/** Icônes du jeu (tracés SVG dessinés pour le jeu), expliquées dans les règles. */
export type IconKey =
  | 'wood'
  | 'stone'
  | 'clay'
  | 'ore'
  | 'glass'
  | 'papyrus'
  | 'textile'
  | 'coin'
  | 'laurel'
  | 'shield'
  | 'gear'
  | 'compass'
  | 'tablet'
  | 'chain'
  | 'crown'
  | 'wonder'
  | 'mountain'
  | 'factory'
  | 'column'
  | 'book'
  | 'scales'

const PATHS: Record<IconKey, ReactNode> = {
  wood: (
    <>
      <path d="M7 7h10a3 5 0 0 1 0 10H7" />
      <ellipse cx="7" cy="12" rx="3" ry="5" />
      <ellipse cx="7" cy="12" rx="1" ry="2" />
    </>
  ),
  stone: <path d="M4 10l3-5h10l3 5v7l-3 3H7l-3-3zM4 10h16M9 5l1 5M15 5l-1 5" />,
  clay: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M3 12h18M9 6v6M15 12v6" />
    </>
  ),
  ore: <path d="M4 18l3-9 5-3 7 4-1 8zM7 9l5 3 7-2M12 12l1 6" />,
  glass: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9" />,
  papyrus: (
    <path d="M8 4h10a2 2 0 0 1 2 2v1h-3M8 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2M9 10h6M9 14h5" />
  ),
  textile: <path d="M4 6c3-2 5 2 8 0s5-2 8 0v12c-3-2-5 2-8 0s-5-2-8 0zM4 12c3-2 5 2 8 0s5-2 8 0" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <path d="M12 9.5v5" />
    </>
  ),
  laurel: (
    <path d="M8 20c-4-3-5-8-3-13M16 20c4-3 5-8 3-13M5 9c2 0 3 1 3 3M4.5 13c2 0 3.5 1 3.5 3M19 9c-2 0-3 1-3 3M19.5 13c-2 0-3.5 1-3.5 3M10 21h4" />
  ),
  shield: <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 7v10M8 11h8" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M11 7L5 21M13 7l6 14M7.5 15h9" />
    </>
  ),
  tablet: <path d="M6 4h12v16H6zM9 8h6M9 11h6M9 14h6M9 17h3" />,
  chain: <path d="M10 14l4-4M9 8l1.5-1.5a4 4 0 0 1 6 6L15 14M15 16l-1.5 1.5a4 4 0 0 1-6-6L9 10" />,
  crown: <path d="M4 18h16l-1-10-4 4-3-6-3 6-4-4zM4 21h16" />,
  wonder: <path d="M3 20h18L12 4zM7.6 12.5h8.8M5.3 16.5h13.4" />,
  mountain: <path d="M3 19l6-11 4 6 3-4 5 9z" />,
  factory: <path d="M4 20V10l5 3v-3l5 3V5h5v15zM3 20h18" />,
  column: <path d="M3 9l9-5 9 5zM5 9v9M10 9v9M14 9v9M19 9v9M3 20h18" />,
  book: <path d="M12 6c-2-1.5-5-2-8-1v13c3-1 6-.5 8 1 2-1.5 5-2 8-1V5c-3-1-6-.5-8 1zM12 6v13" />,
  scales: <path d="M12 4v16M7 20h10M4 8h16M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z" />,
}

/** Rangée d'icônes, chacune précédée de son nombre quand il y en a un (« 5 laurier », « 2 pièce »). */
export function IconRow({ items, size }: { items: { k: IconKey; n?: number }[]; size?: number }) {
  return (
    <span className="sdv-civilisation-icon-row" aria-hidden="true">
      {items.map((item, i) => (
        <span key={i}>
          {item.n !== undefined && <b>{item.n}</b>}
          <GameIcon k={item.k} size={size} />
        </span>
      ))}
    </span>
  )
}

/** Coût en icônes : une icône par ressource, puis les pièces avec leur nombre ; « Gratuit » sinon. */
export function CostIcons({ resources, coins, size }: { resources: IconKey[]; coins?: number; size?: number }) {
  const items: { k: IconKey; n?: number }[] = resources.map((k) => ({ k }))
  if (coins) items.push({ k: 'coin', n: coins })
  return items.length ? <IconRow items={items} size={size} /> : <span className="sdv-civilisation-free">Gratuit</span>
}

/** Icône décorative : le texte équivalent est toujours porté par l'élément qui l'entoure. */
export function GameIcon({ k, size = 18 }: { k: IconKey; size?: number }) {
  return (
    <svg
      className={`sdv-civilisation-icon sdv-civilisation-icon-${k}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[k]}
    </svg>
  )
}
