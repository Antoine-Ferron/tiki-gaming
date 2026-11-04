import * as z from 'zod/mini'

/**
 * Score maximal accepté : tout l'argent gagné en cumulé (récompenses de missions et billets ramassés).
 * Plafond large, aligné avec games.max_score (migration add_game_mini_gta).
 */
export const MAX_SCORE = 1_000_000

const count = () => z.number().check(z.int(), z.nonnegative())

export const WEAPON_IDS = ['fists', 'bat', 'pistol', 'rifle', 'shotgun', 'sniper', 'grenade'] as const

const weaponSlot = z.object({ id: z.enum(WEAPON_IDS), clip: count(), ammo: count() })

/**
 * Progression du joueur, stockée par ctx.save (Supabase connecté, localStorage en invité).
 * Une sauvegarde qui ne respecte pas ce schéma (corrompue, ancienne version) donne une nouvelle partie.
 */
export const saveSchema = z.object({
  version: z.literal(1),
  money: count(),
  /** Argent gagné depuis le début de la partie, jamais diminué par les dépenses : c'est le score. */
  totalEarned: count(),
  armor: z.number().check(z.int(), z.nonnegative(), z.maximum(100)),
  /** null : inventaire de départ. */
  inventory: z.nullable(z.array(weaponSlot)),
  completedMissions: z.array(z.string()),
  stats: z.object({
    kills: count(),
    wantedMax: count(),
    playTime: z.number().check(z.nonnegative()),
  }),
})

export type MiniGtaSave = z.infer<typeof saveSchema>

export function newSave(): MiniGtaSave {
  return {
    version: 1,
    money: 500,
    totalEarned: 0,
    armor: 0,
    inventory: null,
    completedMissions: [],
    stats: { kills: 0, wantedMax: 0, playTime: 0 },
  }
}

/** Score à envoyer (plafonné), ou null s'il ne bat pas le dernier score envoyé. */
export function scoreToSubmit(totalEarned: number, lastSent: number | null): number | null {
  const score = Math.min(totalEarned, MAX_SCORE)
  return score > (lastSent ?? 0) ? score : null
}
