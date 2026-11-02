import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthContext'

export function Layout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand">
          Tiki Gaming
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Jeux
          </NavLink>
          {user ? (
            <>
              <NavLink to="/profile">{profile?.username ?? 'Profil'}</NavLink>
              <button className="link" onClick={handleSignOut}>
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Connexion</NavLink>
              <NavLink to="/signup" className="button small">
                Inscription
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
