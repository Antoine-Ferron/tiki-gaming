// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CharacterCard } from '../../cards/CharacterCard'
import type { Character } from '../../cards/characters'

afterEach(cleanup)

const CHARACTERS: [Character, string, number, string][] = [
  ['bart-cassidy', 'Bart Cassidy', 4, "Chaque fois qu'il perd un point de vie, il pioche une carte."],
  [
    'calamity-janet',
    'Calamity Janet',
    4,
    'Elle peut jouer un BANG ! comme un Raté ! et inversement. Un Raté ! joué pour tirer compte comme son BANG ! du tour.',
  ],
  [
    'paul-regret',
    'Paul Regret',
    3,
    'Les autres joueurs le voient à une distance augmentée de 1. Sa distance vers eux reste normale.',
  ],
  ['willy-the-kid', 'Willy le Kid', 4, "Il peut jouer autant de BANG ! qu'il veut pendant son tour."],
]

describe('CharacterCard', () => {
  test.each(CHARACTERS)('affiche l’image, le nom, les PV et le pouvoir de %s', (character, name, life, power) => {
    const { container } = render(<CharacterCard character={character} />)

    expect(container.querySelector('img')?.getAttribute('src')).toBe(`/games/bang/cards/characters/${character}.webp`)
    expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getByText(`${life} PV`)).toBeTruthy()
    expect(screen.getByText(power)).toBeTruthy()
  })
})
