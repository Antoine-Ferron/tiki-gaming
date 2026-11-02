import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { apiPost } from '@/lib/api'
import { logger } from '@/lib/logger'
import { clearSession, fetchSession, onSessionChange, type AuthUser } from '@/lib/session'
import { AuthContext, type AuthContextValue, type Profile } from './AuthContext'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) logger.error({ err: error }, 'Chargement du profil impossible')
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  // Profil mémorisé avec l'id de son propriétaire : un profil d'un autre user n'est jamais exposé.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const userId = user?.id
  const profile = loaded && loaded.userId === userId ? loaded.profile : null

  useEffect(() => {
    const unsubscribe = onSessionChange((next) => setUser((prev) => (prev?.id === next?.id ? prev : next)))
    fetchSession()
      .catch((err) => logger.error({ err }, 'Backend d’authentification injoignable'))
      .finally(() => setLoading(false))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchProfile(userId).then((p) => {
      if (!cancelled) setLoaded({ userId, profile: p })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (userId) setLoaded({ userId, profile: await fetchProfile(userId) })
  }, [userId])

  const refreshSession = useCallback(async () => {
    await fetchSession()
  }, [])

  const signOut = useCallback(async () => {
    await apiPost('/auth/logout')
    clearSession()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, loading, refreshProfile, refreshSession, signOut }),
    [user, profile, loading, refreshProfile, refreshSession, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
