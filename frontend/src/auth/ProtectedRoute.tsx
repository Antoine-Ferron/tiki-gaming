import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="muted">Chargement…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

/** Pages réservées aux visiteurs. Sans enfant, sert de route parente et affiche ses sous-routes. */
export function GuestOnlyRoute({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">Chargement…</p>
  if (user) return <Navigate to="/" replace />
  return children ?? <Outlet />
}
