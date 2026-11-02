import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getAccessToken } from './session'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants : copiez .env.example en .env')
}

// Client unique pour les données (plateforme + jeux). L'authentification est gérée par le backend Java,
// qui fournit le JWT reconnu par la RLS : supabase.auth n'est pas utilisable.
export const supabase = createClient<Database>(url, anonKey, { accessToken: getAccessToken })
