import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useUiStore } from './uiStore'

const texts = () => useUiStore.getState().notifications.map((n) => n.text)

beforeEach(() => {
  vi.useRealTimers()
  useUiStore.getState().reset()
})

describe('interface du jeu', () => {
  test('ouvre et ferme un menu', () => {
    useUiStore.getState().setMenu('pause')
    expect(useUiStore.getState().menu).toBe('pause')

    useUiStore.getState().setMenu(null)

    expect(useUiStore.getState().menu).toBeNull()
  })

  test('une notification est de type info par défaut', () => {
    useUiStore.getState().notify('Bienvenue')

    expect(useUiStore.getState().notifications[0]).toMatchObject({ text: 'Bienvenue', kind: 'info' })
  })

  test('garde au plus six notifications, les plus récentes', () => {
    for (let i = 1; i <= 8; i++) useUiStore.getState().notify(`n${i}`)

    expect(texts()).toEqual(['n3', 'n4', 'n5', 'n6', 'n7', 'n8'])
  })

  test.each([
    ['grand titre', 'big', 3400, 3600],
    ['information', 'info', 5900, 6100],
    ['succès', 'success', 4400, 4600],
    ['échec', 'fail', 4400, 4600],
  ] as const)('%s : visible puis effacé', (_, kind, still, gone) => {
    useUiStore.getState().notify('message', kind)
    const at = useUiStore.getState().notifications[0].at

    useUiStore.getState().prune(at + still)
    expect(texts()).toEqual(['message'])

    useUiStore.getState().prune(at + gone)
    expect(texts()).toEqual([])
  })

  test('un nettoyage sans effet ne change pas l’état', () => {
    useUiStore.getState().notify('message')
    const before = useUiStore.getState()

    useUiStore.getState().prune(before.notifications[0].at + 10)

    expect(useUiStore.getState()).toBe(before)
  })

  test('reset remet l’interface à zéro au lancement, sans oublier la sortie', () => {
    const exit = () => {}
    useUiStore.setState({
      menu: 'map',
      started: true,
      loading: null,
      loadError: 'oups',
      waypoint: { x: 1, z: 2 },
      exit,
    })
    useUiStore.getState().notify('ancienne')

    useUiStore.getState().reset()

    const s = useUiStore.getState()
    expect(s).toMatchObject({ menu: null, started: false, loadError: null, waypoint: null, notifications: [] })
    expect(s.loading).not.toBeNull()
    expect(s.exit).toBe(exit)
  })
})
