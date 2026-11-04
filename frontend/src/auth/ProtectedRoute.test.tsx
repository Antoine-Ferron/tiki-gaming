// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { GuestOnlyRoute, ProtectedRoute } from './ProtectedRoute'
import { player, renderPage } from './testing'

afterEach(cleanup)

describe('ProtectedRoute', () => {
  test('attend la fin du chargement de la session', () => {
    renderPage(<ProtectedRoute>contenu réservé</ProtectedRoute>, { url: '/profile', auth: { loading: true } })

    expect(screen.getByText('Chargement…')).toBeTruthy()
    expect(screen.queryByText('contenu réservé')).toBeNull()
  })

  test('renvoie un visiteur vers la connexion en mémorisant la page demandée', () => {
    renderPage(<ProtectedRoute>contenu réservé</ProtectedRoute>, { url: '/profile' })

    expect(screen.getByTestId('destination').textContent).toBe('/login {"from":"/profile"}')
  })

  test('affiche la page à un joueur connecté', () => {
    renderPage(<ProtectedRoute>contenu réservé</ProtectedRoute>, { url: '/profile', auth: { user: player } })

    expect(screen.getByText('contenu réservé')).toBeTruthy()
  })
})

describe('GuestOnlyRoute', () => {
  test('attend la fin du chargement de la session', () => {
    renderPage(<GuestOnlyRoute>formulaire</GuestOnlyRoute>, { url: '/login', auth: { loading: true } })

    expect(screen.getByText('Chargement…')).toBeTruthy()
  })

  test('affiche la page à un visiteur', () => {
    renderPage(<GuestOnlyRoute>formulaire</GuestOnlyRoute>, { url: '/login' })

    expect(screen.getByText('formulaire')).toBeTruthy()
  })

  test('renvoie un joueur déjà connecté vers l’accueil', () => {
    renderPage(<GuestOnlyRoute>formulaire</GuestOnlyRoute>, { url: '/login', auth: { user: player } })

    expect(screen.getByTestId('destination').textContent).toBe('/ null')
  })
})
