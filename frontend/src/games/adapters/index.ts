import type { GameDeps } from '../sdk'
import { browserStorage } from './local'
import { supabaseSaves, supabaseScores } from './supabase'

/** Point d'assemblage : branche les ports du SDK sur Supabase et le localStorage du navigateur. */
export function platformDeps(): GameDeps {
  return { scores: supabaseScores, playerSaves: supabaseSaves, storage: browserStorage() }
}
