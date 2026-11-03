// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RoleCard } from '../../cards/RoleCard'
import type { Role } from '../../cards/roles'

afterEach(cleanup)

const ROLES: Role[] = ['sheriff', 'deputy', 'outlaw', 'renegade']

const FACES: [Role, string, string][] = [
  ['sheriff', 'Shérif', 'Doit éliminer tous les hors-la-loi et le Renégat pour faire régner la loi.'],
  [
    'deputy',
    'Adjoint',
    "Aident et protègent le Shérif. Ils ont le même but que lui et ils l'accompliront coûte que coûte.",
  ],
  [
    'outlaw',
    'Hors-la-loi',
    "Ont envie de tuer le Shérif, mais ils n'ont aucun scrupule à s'entretuer pour ramasser les récompenses.",
  ],
  ['renegade', 'Renégat', "Veut prendre la place du Shérif : son but est d'être le dernier personnage en jeu."],
]

describe('RoleCard face cachée', () => {
  test('montre le même dos pour les quatre rôles', () => {
    const backs = ROLES.map((role) => {
      const { container, unmount } = render(<RoleCard role={role} faceUp={false} />)
      const html = container.innerHTML
      unmount()
      return html
    })

    expect(new Set(backs).size).toBe(1)
    expect(backs[0]).toContain('/games/bang/cards/back/back.webp')
  })

  test.each(FACES)('ne révèle rien du rôle %s', (role, name, goal) => {
    const { container } = render(<RoleCard role={role} faceUp={false} />)

    expect(container.textContent).not.toContain(name)
    expect(container.textContent).not.toContain(goal)
    expect(container.innerHTML).not.toContain(role)
  })
})

describe('RoleCard face visible', () => {
  test.each(FACES)('affiche l’image, le nom et l’objectif du rôle %s', (role, name, goal) => {
    const { container } = render(<RoleCard role={role} faceUp />)

    expect(container.querySelector('img')?.getAttribute('src')).toBe(`/games/bang/cards/roles/${role}.webp`)
    expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getByText(goal)).toBeTruthy()
  })
})
