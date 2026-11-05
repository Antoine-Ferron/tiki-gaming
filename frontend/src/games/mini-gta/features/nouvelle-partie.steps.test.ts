import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { createGameContext } from '@/games/sdk'
import { fakeDeps } from '@/games/testing/fakes'
import miniGta from '..'
import { newSave, saveSchema, type MiniGtaSave } from '../domain/save'
import { createInventory } from '../systems/weapons'

/** Montant lu par {currency} dans le texte de l'étape (« 500 $ »). */
type Amount = { value: number }

const feature = await loadFeature('src/games/mini-gta/features/nouvelle-partie.feature', { language: 'fr' })

const player = { id: 'p1', username: 'alice' }

/** Défauts d'une sauvegarde, décrits comme au joueur, et le champ abîmé correspondant. */
const DEFECTS: Record<string, Record<string, number>> = {
  "d'une autre version du jeu": { version: 2 },
  'avec un solde négatif': { money: -1 },
  'avec des gains non entiers': { totalEarned: 12.5 },
  'avec une armure au-delà de 100': { armor: 101 },
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let deps: ReturnType<typeof fakeDeps>
  let save: MiniGtaSave

  function stored(data: Record<string, unknown>) {
    deps = fakeDeps()
    deps.saves.data.set(miniGta.slug, { ...newSave(), ...data })
  }

  /** Comme l'écran d'accueil : la sauvegarde validée par son schéma, sinon une nouvelle partie. */
  async function load() {
    const ctx = createGameContext(miniGta, player, deps)
    save = (await ctx.loadSave(saveSchema)) ?? newSave()
  }

  Scenario('Une nouvelle partie commence avec 500 $, sans armure et les poings en main', ({ When, Then, And }) => {
    When('un joueur commence une nouvelle partie', () => {
      save = newSave()
    })
    Then('il a {currency}', (_, money: Amount) => {
      expect(save.money).toBe(money.value)
    })
    And("il n'a encore rien gagné", () => {
      expect(save.totalEarned).toBe(0)
    })
    And("il n'a pas d'armure", () => {
      expect(save.armor).toBe(0)
    })
    And('il a les poings en main', () => {
      // inventaire null : celui de départ, construit par le joueur à son apparition
      expect(save.inventory).toBeNull()
      expect(createInventory().current).toBe('fists')
    })
    And("aucune mission n'est terminée", () => {
      expect(save.completedMissions).toEqual([])
    })
  })

  Scenario('Une sauvegarde valide est reprise', ({ Given, When, Then, And }) => {
    Given('une sauvegarde avec {currency} et la mission {string} terminée', (_, money: Amount, mission: string) =>
      stored({ money: money.value, completedMissions: [mission] }),
    )
    When('le jeu charge la sauvegarde', load)
    Then('il a {currency}', (_, money: Amount) => {
      expect(save.money).toBe(money.value)
    })
    And('la mission {string} est terminée', (_, mission: string) => {
      expect(save.completedMissions).toEqual([mission])
    })
  })

  ScenarioOutline(
    "Une sauvegarde corrompue ou d'une autre version donne une nouvelle partie",
    ({ Given, When, Then, And }, variables) => {
      Given('une sauvegarde <défaut>', () => {
        expect(DEFECTS).toHaveProperty([variables['défaut']])
        stored({ money: 2400, totalEarned: 2400, ...DEFECTS[variables['défaut']] })
      })
      When('le jeu charge la sauvegarde', load)
      Then('il a 500 $', () => {
        expect(save.money).toBe(500)
      })
      And("il n'a encore rien gagné", () => {
        expect(save.totalEarned).toBe(0)
      })
    },
  )
})
