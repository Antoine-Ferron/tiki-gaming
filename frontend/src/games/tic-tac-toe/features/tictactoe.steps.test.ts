import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { TicTacToeGame } from '../domain/game'

const feature = await loadFeature('src/games/tic-tac-toe/features/tictactoe.feature', { language: 'fr' })

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  let game: TicTacToeGame

  function play(coordinates: string) {
    for (const move of coordinates.split(';')) {
      const [row, column] = move.split(',').map(Number)
      game.place(row - 1, column - 1)
    }
  }

  Scenario('Une partie commence avec X et alterne les joueurs', ({ Given, When, Then, And }) => {
    Given('une nouvelle partie', () => {
      game = new TicTacToeGame()
    })
    Then('le joueur courant est X', () => expect(game.currentPlayer()).toBe('X'))
    And('toutes les cases sont vides', () => {
      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
          expect(game.cell(row, column)).toBeUndefined()
        }
      }
    })
    When('X joue en ligne 1 colonne 1', () => game.place(0, 0))
    Then('le joueur courant est O', () => expect(game.currentPlayer()).toBe('O'))
    And('la case ligne 1 colonne 1 contient X', () => expect(game.cell(0, 0)).toBe('X'))
  })

  Scenario('Une case occupée ou des coordonnées invalides sont refusées', ({ Given, When, Then, And }) => {
    Given('une nouvelle partie', () => {
      game = new TicTacToeGame()
    })
    When('X joue en ligne 1 colonne 1', () => game.place(0, 0))
    Then('jouer en ligne 1 colonne 1 est refusé', () => {
      expect(() => game.place(0, 0)).toThrow('La case est déjà occupée.')
    })
    And('jouer en ligne 0 colonne 1 est refusé', () => {
      expect(() => game.place(-1, 0)).toThrow('Les coordonnées doivent être comprises entre 0 et 2.')
    })
  })

  ScenarioOutline('Une ligne, colonne ou diagonale donne la victoire', ({ Given, When, Then }, variables) => {
    Given('une nouvelle partie', () => {
      game = new TicTacToeGame()
    })
    When('les coups suivants sont joués: <coups>', () => {
      play(String(variables.coups))
    })
    Then('le statut de la partie est <statut>', () => {
      expect(game.status()).toBe(variables.statut)
    })
  })

  Scenario('Une grille pleine sans ligne gagnante est un match nul', ({ Given, When, Then }) => {
    Given('une nouvelle partie', () => {
      game = new TicTacToeGame()
    })
    When('les coups suivants sont joués: 1,1; 1,2; 1,3; 2,2; 2,1; 2,3; 3,2; 3,1; 3,3', () => {
      play('1,1; 1,2; 1,3; 2,2; 2,1; 2,3; 3,2; 3,1; 3,3')
    })
    Then('le statut de la partie est DRAW', () => {
      expect(game.status()).toBe('DRAW')
    })
  })
})
