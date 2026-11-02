import { Route, Routes } from 'react-router'
import { Layout } from '@/components/Layout'
import { GuestOnlyRoute, ProtectedRoute } from '@/auth/ProtectedRoute'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import UpdatePasswordPage from '@/pages/UpdatePasswordPage'
import ProfilePage from '@/pages/ProfilePage'
import GamePage from '@/pages/GamePage'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
        <Route path="signup" element={<GuestOnlyRoute><SignupPage /></GuestOnlyRoute>} />
        <Route path="forgot-password" element={<GuestOnlyRoute><ForgotPasswordPage /></GuestOnlyRoute>} />
        <Route path="update-password" element={<ProtectedRoute><UpdatePasswordPage /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        {/* L'accès (solo = invité autorisé, multijoueur = connexion) est géré par GamePage */}
        <Route path="games/:slug" element={<GamePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
