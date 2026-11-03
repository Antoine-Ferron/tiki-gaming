import { describe, expect, it } from 'vitest'
import { games, getGame } from './registry'

describe('game registry', () => {
  it('registers Mastermind with its score limit', () => {
    const mastermind = getGame('mastermind')

    expect(mastermind).toBeDefined()
    expect(mastermind?.scoreLimits).toEqual({ max: 10 })
    expect(games).toContain(mastermind)
  })
})
