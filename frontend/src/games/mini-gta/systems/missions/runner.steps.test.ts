import { describe, expect, test } from 'vitest'
import { MissionRunner, type MissionContext, type Step } from './runner'

function ctx(over: Partial<MissionContext> = {}): MissionContext {
  return {
    playerPos: () => ({ x: 0, z: 0 }),
    inVehicle: () => false,
    vehicleTag: () => null,
    alive: () => true,
    wanted: () => 0,
    ...over,
  }
}

describe('étapes de mission', () => {
  test.each<[string, Step, Partial<MissionContext>, 'running' | 'success']>([
    [
      'à pied exigé, en véhicule : attend',
      { type: 'goto', text: '', pos: { x: 0, z: 0 }, radius: 2, onFoot: true },
      { inVehicle: () => true },
      'running',
    ],
    [
      'à pied exigé, à pied : validé',
      { type: 'goto', text: '', pos: { x: 0, z: 0 }, radius: 2, onFoot: true },
      {},
      'success',
    ],
    [
      'cibles vivantes : attend',
      { type: 'eliminate', text: '', tags: ['a', 'b'] },
      { alive: (t) => t === 'b' },
      'running',
    ],
    [
      'toutes les cibles éliminées : validé',
      { type: 'eliminate', text: '', tags: ['a', 'b'] },
      { alive: () => false },
      'success',
    ],
    ['véhicule à détruire intact : attend', { type: 'destroy', text: '', tag: 'v' }, {}, 'running'],
    ['véhicule détruit : validé', { type: 'destroy', text: '', tag: 'v' }, { alive: () => false }, 'success'],
    ['recherché : attend', { type: 'escape', text: '' }, { wanted: () => 1 }, 'running'],
    [
      'livraison sans le bon véhicule : attend',
      { type: 'deliver', text: '', pos: { x: 0, z: 0 }, radius: 2, requireTag: 'v' },
      { vehicleTag: () => 'autre' },
      'running',
    ],
  ])('%s', (_, step, over, expected) => {
    const r = new MissionRunner([step])

    expect(r.update(0.1, ctx(over))).toBe(expected)
  })

  test('une attente se termine après sa durée et affiche le temps restant', () => {
    const r = new MissionRunner([{ type: 'wait', text: '', seconds: 1 }])

    r.update(0.4, ctx())
    expect(r.timeLeft).toBeCloseTo(0.6)
    r.update(0.7, ctx())

    expect(r.status).toBe('success')
  })

  test.each<[string, Step]>([
    ['véhicule à voler détruit', { type: 'enterVehicle', text: '', tag: 'v' }],
    ['véhicule à livrer détruit', { type: 'deliver', text: '', pos: { x: 9, z: 9 }, radius: 1, requireTag: 'v' }],
  ])('%s : la mission échoue', (_, step) => {
    const r = new MissionRunner([step])

    r.update(0.1, ctx({ alive: () => false }))

    expect(r.status).toBe('failed')
    expect(r.failReason).toBe('Le véhicule est détruit')
  })

  test('une règle d’échec l’emporte sur l’étape en cours', () => {
    const r = new MissionRunner([{ type: 'escape', text: '' }], [{ reason: 'Trop tard', check: () => true }])

    expect(r.update(0.1, ctx())).toBe('failed')
    expect(r.failReason).toBe('Trop tard')
  })

  test('une mission terminée ne change plus, même si on la fait échouer', () => {
    const r = new MissionRunner([{ type: 'escape', text: '' }])
    r.update(0.1, ctx())

    r.fail('trop tard')

    expect(r.status).toBe('success')
    expect(r.update(0.1, ctx({ wanted: () => 3 }))).toBe('success')
    expect(r.timeLeft).toBeNull()
  })

  test('une mission sans étape réussit immédiatement', () => {
    expect(new MissionRunner([]).update(0.1, ctx())).toBe('success')
  })
})
