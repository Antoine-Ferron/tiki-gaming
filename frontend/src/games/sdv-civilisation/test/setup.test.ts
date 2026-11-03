import { describe, expect, it } from 'vitest'
import { createPlayers, neighbours } from '../setup'

describe('createPlayers', () => {
  it('crée un joueur par nom, avec 3 pièces', () => {
    expect(createPlayers(['Matéo', 'IA 1', 'IA 2'])).toEqual([
      { name: 'Matéo', coins: 3 },
      { name: 'IA 1', coins: 3 },
      { name: 'IA 2', coins: 3 },
    ])
  })

  it('refuse moins de 3 ou plus de 7 joueurs', () => {
    expect(() => createPlayers(['A', 'B'])).toThrow('Il faut entre 3 et 7 joueurs')
    expect(() => createPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])).toThrow('Il faut entre 3 et 7 joueurs')
  })
})

describe('neighbours', () => {
  it('assoit les joueurs en cercle', () => {
    const players = createPlayers(['A', 'B', 'C'])

    expect(neighbours(players, 0)).toEqual({ left: players[2], right: players[1] })
  })
})
