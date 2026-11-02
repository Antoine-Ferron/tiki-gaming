import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue, type Profile } from './AuthContext'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) console.error('Chargement du profil impossible', error)
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // Profil mémorisé avec l'id de son propriétaire : un profil d'un autre user n'est jamais exposé.
  const [loaded, setLoaded] = useState<{ userId: string; profile: Profile | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const userId = session?.user.id
  const profile = loaded && loaded.userId === userId ? loaded.profile : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    // Ne pas appeler supabase de façon synchrone dans ce callback (risque de deadlock).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, profile, loading, refreshProfile, signOut }),
    [session, profile, loading, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
