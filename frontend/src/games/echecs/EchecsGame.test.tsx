// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import EchecsGame from './EchecsGame'

afterEach(cleanup)

test("l'échiquier affiche 64 cases (règle E1)", () => {
  // Arrange + Act
  render(<EchecsGame />)

  // Assert
  expect(screen.getByRole('img', { name: 'Échiquier vide' }).children).toHaveLength(64)
})

test('la case h1 est claire et la case a1 est foncée (règle E3)', () => {
  // Arrange + Act
  const { container } = render(<EchecsGame />)

  // Assert
  expect(container.querySelector('[data-square="h1"]')).toHaveClass('echecs-square-light')
  expect(container.querySelector('[data-square="a1"]')).toHaveClass('echecs-square-dark')
})
