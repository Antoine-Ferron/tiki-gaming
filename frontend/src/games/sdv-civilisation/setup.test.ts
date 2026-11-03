import { describe, expect, it } from 'vitest'
import { createPlayers, neighbours } from './setup'

describe('createPlayers', () => {
  it('crée un joueur par nom, avec 1 pièce', () => {
    const players = createPlayers(['Matéo', 'IA 1', 'IA 2'])

    expect(players).toEqual([
      { name: 'Matéo', coins: 1 },
      { name: 'IA 1', coins: 1 },
      { name: 'IA 2', coins: 1 },
    ])
  })

  it('accepte 7 joueurs', () => {
    const players = createPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G'])

    expect(players).toHaveLength(7)
  })

  it('refuse moins de 3 joueurs', () => {
    expect(() => createPlayers(['Matéo', 'IA 1'])).toThrow('Il faut entre 3 et 7 joueurs')
  })

  it('refuse plus de 7 joueurs', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

    expect(() => createPlayers(names)).toThrow('Il faut entre 3 et 7 joueurs')
  })
})

describe('neighbours', () => {
  const players = createPlayers(['A', 'B', 'C', 'D'])

  it('donne les joueurs assis de part et d’autre', () => {
    const { left, right } = neighbours(players, 1)

    expect(left.name).toBe('A')
    expect(right.name).toBe('C')
  })

  it('fait du dernier joueur le voisin de gauche du premier', () => {
    expect(neighbours(players, 0).left.name).toBe('D')
  })

  it('fait du premier joueur le voisin de droite du dernier', () => {
    expect(neighbours(players, 3).right.name).toBe('A')
  })
})
