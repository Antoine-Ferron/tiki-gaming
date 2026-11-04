import { expect, test } from 'vitest'
import { canPlay } from './device'

test.each([
  ['ordinateur avec souris', { finePointer: true, width: 1280 }, true],
  ['écran étroit de 360px avec souris', { finePointer: true, width: 360 }, true],
  ['moins de 360px', { finePointer: true, width: 359 }, false],
  ['écran tactile sans souris', { finePointer: false, width: 1280 }, false],
])('%s', (_, device, expected) => {
  expect(canPlay(device)).toBe(expected)
})
