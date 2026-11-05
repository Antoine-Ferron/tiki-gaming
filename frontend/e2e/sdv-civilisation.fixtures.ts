import { readFileSync } from 'node:fs'
import type { BrowserContext } from '@playwright/test'

// Vues de partie écrites par le backend (GameViewContractTest) : le faux serveur ne renvoie que des réponses
// réelles de l'API, dans l'ordre où le backend les produit.
const contract = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../src/games/sdv-civilisation/test/contract/${name}.json`, import.meta.url), 'utf8'))

/** Merveille et coup du contrat : la Citadelle d'Orkan, puis la 7ᵉ carte de la main (l'Atelier) construite. */
export const WONDER = 'Citadelle d’Orkan'
export const BUILT_CARD = 'Atelier'
const BUILT_INDEX = 6

// Message du backend (SdvCivilisationService.STALE) quand un coup est envoyé sur une version périmée.
export const STALE = 'La partie a avancé entre-temps : voici le tour en cours.'

/**
 * Faux serveur de SDV Civilisation (fake) pour tout le contexte du navigateur : la partie survit au rechargement et
 * est partagée entre onglets, comme la session HTTP d'un invité. Le verrou de version est celui du backend : un coup
 * qui n'attend pas la version en cours reçoit un 409 avec la partie à jour.
 */
export async function mockSdvCivilisation(context: BrowserContext) {
  const views: Record<number, unknown> = { 1: contract('start'), 2: contract('turn-2') }
  let version = 0

  await context.route('**/api/games/sdv-civilisation/wonders', (route) => route.fulfill({ json: contract('wonders') }))
  await context.route('**/api/games/sdv-civilisation/games', (route) => {
    const { wonder } = route.request().postDataJSON() as { wonder: string }
    if (wonder !== WONDER) return route.fulfill({ status: 400, json: { error: `Merveille hors contrat : ${wonder}` } })
    version = 1
    return route.fulfill({ json: views[version] })
  })
  await context.route('**/api/games/sdv-civilisation/games/current', (route) =>
    version ? route.fulfill({ json: views[version] }) : route.fulfill({ status: 204 }),
  )
  await context.route('**/api/games/sdv-civilisation/games/current/turns', (route) => {
    const turn = route.request().postDataJSON() as { card: number; action: string; version: number }
    if (turn.version !== version) return route.fulfill({ status: 409, json: { error: STALE, game: views[version] } })
    if (version !== 1 || turn.card !== BUILT_INDEX || turn.action !== 'build')
      return route.fulfill({ status: 400, json: { error: `Coup hors contrat : ${JSON.stringify(turn)}` } })
    version = 2
    return route.fulfill({ json: views[version] })
  })
}
