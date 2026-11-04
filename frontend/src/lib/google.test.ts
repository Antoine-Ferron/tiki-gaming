import { describe, expect, test } from 'vitest'
import { googleAuthUrl } from './google'

describe('googleAuthUrl', () => {
  test('passe la page de retour au backend', () => {
    expect(googleAuthUrl('/')).toBe('/api/auth/google?redirect=%2F')
  })

  test('encode la page de retour : ses propres paramètres ne se mélangent pas à ceux de l’URL', () => {
    expect(googleAuthUrl('/games/clicker?mode=duel&x=1')).toBe(
      '/api/auth/google?redirect=%2Fgames%2Fclicker%3Fmode%3Dduel%26x%3D1',
    )
  })
})
