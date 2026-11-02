import { createContext, useContext } from 'react'
import type { Tables } from '@/lib/database.types'
import type { AuthUser } from '@/lib/session'

export type Profile = Tables<'profiles'>

export type AuthContextValue = {
  user: AuthUser | null
  profile: Profile | null
  /** true tant que la session initiale n'est pas résolue */
  loading: boolean
  refreshProfile: () => Promise<void>
  /** À appeler après une connexion/inscription pour relire la session du backend */
  refreshSession: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
