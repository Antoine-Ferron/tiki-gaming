import { describe, expect, it } from 'vitest'
import { EventBus } from './events'

interface TestEvents {
  ping: { n: number }
}

describe('EventBus', () => {
  it('delivers payloads and supports unsubscribe', () => {
    const bus = new EventBus<TestEvents>()
    const got: number[] = []
    const off = bus.on('ping', ({ n }) => got.push(n))
    bus.emit('ping', { n: 1 })
    off()
    bus.emit('ping', { n: 2 })
    expect(got).toEqual([1])
  })
})
