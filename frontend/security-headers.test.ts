import { describe, expect, test } from 'vitest'
import { contentSecurityPolicy, securityHeaders } from './security-headers'

describe('contentSecurityPolicy', () => {
  const csp = contentSecurityPolicy('https://abcd.supabase.co')
  const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `))

  test('autorise les appels au Supabase du projet (REST et websocket), rien d’autre hors de l’origine', () => {
    expect(directive('connect-src')).toBe("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co")
  })

  test('n’autorise ni script inline, ni eval, ni style inline', () => {
    expect(directive('script-src')).toBe("script-src 'self'")
    expect(directive('style-src')).toBe("style-src 'self'")
    expect(csp).not.toContain('unsafe')
  })

  test('aucune directive joker : les images viennent du front ou du Supabase du projet', () => {
    expect(directive('img-src')).toBe("img-src 'self' data: https://abcd.supabase.co")
    expect(csp).not.toMatch(/ (https?:|\*)(;|$| )/)
  })

  test('interdit l’intégration dans une iframe et les plugins', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive('object-src')).toBe("object-src 'none'")
  })

  test('ignore le chemin éventuel de l’URL Supabase', () => {
    expect(contentSecurityPolicy('https://abcd.supabase.co/rest/v1')).toContain("'self' https://abcd.supabase.co wss:")
  })
})

test('securityHeaders couvre les alertes ZAP corrigées (CSP, clickjacking, nosniff, permissions)', () => {
  expect(Object.keys(securityHeaders('https://abcd.supabase.co'))).toEqual(
    expect.arrayContaining([
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Permissions-Policy',
    ]),
  )
})
