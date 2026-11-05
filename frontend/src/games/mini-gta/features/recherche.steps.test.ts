import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { WantedLevel, type Crime } from '../systems/Wanted'

const feature = await loadFeature('src/games/mini-gta/features/recherche.feature', { language: 'fr' })

const CRIMES: Record<string, Crime> = {
  agression: 'assault',
  'vol de voiture': 'carjack',
  "meurtre d'un passant": 'killCivilian',
  "meurtre d'un policier": 'killCop',
}

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let wanted: WantedLevel

  function commit(times: number, label: string, witnessed: boolean) {
    expect(CRIMES).toHaveProperty([label])
    wanted = new WantedLevel()
    for (let i = 0; i < times; i++) wanted.commit(CRIMES[label], 0, 0, witnessed)
  }

  function wantedWith(stars: number) {
    wanted = new WantedLevel()
    wanted.setMinimum(stars, 0, 0)
  }

  /** La police ne voit plus le joueur, resté au dernier endroit connu ou parti hors du cercle de recherche. */
  function unseen(seconds: number, where: string) {
    const away = where === 'hors de' ? wanted.searchRadius + 50 : 0
    wanted.update(seconds, false, away, 0)
  }

  ScenarioOutline('Les crimes vus par un témoin font monter le niveau de recherche', ({ When, Then }, variables) => {
    When('il commet <fois> fois le crime "<crime>" devant un témoin', () =>
      commit(Number(variables.fois), variables.crime, true),
    )
    Then('il est recherché avec <étoiles> étoile(s)', () => {
      expect(wanted.stars).toBe(Number(variables['étoiles']))
    })
  })

  Scenario('Un crime sans témoin ne compte pas', ({ When, Then }) => {
    When('il commet {int} fois le crime {string} sans témoin', (_, times: number, label: string) =>
      commit(times, label, false),
    )
    Then("il n'est pas recherché", () => {
      expect(wanted.stars).toBe(0)
    })
  })

  ScenarioOutline('Hors de vue de la police, le niveau finit par retomber', ({ Given, When, Then }, variables) => {
    Given('un joueur recherché avec <étoiles> étoile(s)', () => wantedWith(Number(variables['étoiles'])))
    When('la police le perd de vue pendant <secondes> secondes, <où> la zone de recherche', () =>
      unseen(Number(variables.secondes), variables['où']),
    )
    Then('il est recherché avec <reste> étoile(s)', () => {
      expect(wanted.stars).toBe(Number(variables.reste))
    })
  })

  Scenario('Repéré par la police, le joueur doit à nouveau se cacher', ({ Given, When, And, Then }) => {
    Given('un joueur recherché avec {int} étoile\\(s\\)', (_, stars: number) => wantedWith(stars))
    When('la police le perd de vue pendant {int} secondes, dans la zone de recherche', (_, seconds: number) =>
      unseen(seconds, 'dans'),
    )
    And('la police le repère', () => {
      wanted.update(0.1, true, 0, 0)
    })
    And('la police le perd de vue pendant {int} secondes, dans la zone de recherche', (_, seconds: number) =>
      unseen(seconds, 'dans'),
    )
    Then('il est recherché avec {int} étoile\\(s\\)', (_, stars: number) => {
      expect(wanted.stars).toBe(stars)
    })
  })
})
