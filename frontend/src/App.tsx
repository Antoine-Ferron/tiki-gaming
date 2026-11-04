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
        <Route element={<GuestOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        {/* Accessible connecté, ou via le lien de réinitialisation reçu par email */}
        <Route path="update-password" element={<UpdatePasswordPage />} />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        {/* L'accès (solo = invité autorisé, multijoueur = connexion) est géré par GamePage */}
        <Route path="games/:slug" element={<GamePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
