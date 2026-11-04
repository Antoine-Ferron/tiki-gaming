import { expect, test } from 'vitest'
import { formatMoney } from './format'

test.each([
  [0, '0 $'],
  [500, '500 $'],
  [1200, '1 200 $'],
  [1_000_000, '1 000 000 $'],
])('%d → %s', (n, expected) => {
  // Le séparateur de milliers français est une espace fine insécable.
  expect(formatMoney(n).replace(/\s/g, ' ')).toBe(expected)
})
