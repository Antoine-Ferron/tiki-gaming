import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Tables } from '@/lib/database.types'

export type Profile = Tables<'profiles'>

export type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** true tant que la session initiale n'est pas résolue */
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
