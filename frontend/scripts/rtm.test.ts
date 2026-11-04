import { describe, expect, it } from 'vitest'
import { checkMatrix, parseMatrix } from './rtm.mjs'

const matrix = (cases: string, bugs = '') => `
# Matrice

## Exigences

| Exigence | Besoin | Source |
|----------|--------|--------|
| REQ-SCORE-01 | Un score est un entier entre 0 et le maximum | Cahier des charges §2 |

## Cas de test

| Cas | Exigence | Nature | Niveau | Preuve | Statut | Anomalie |
|-----|----------|--------|--------|--------|--------|----------|
${cases}

## Anomalies

| Anomalie | Titre | Sévérité | Priorité | Statut | Correctif |
|----------|-------|----------|----------|--------|-----------|
${bugs}
`

const nominal = '| TC-SCORE-01 | REQ-SCORE-01 | nominal | unitaire | `src/score.test.ts` › accepte 0 | PASSED | — |'
const error = '| TC-SCORE-02 | REQ-SCORE-01 | erreur | unitaire | `src/score.test.ts` › refuse -1 | PASSED | — |'
const files: Record<string, string> = {
  'src/score.test.ts': "test('accepte 0')\ntest('refuse -1, juste sous la frontière')",
}
const read = (path: string) => files[path] ?? null
const errorsOf = (md: string) => checkMatrix(parseMatrix(md), read)

describe('parseMatrix', () => {
  it('lit les trois tableaux, sans les lignes d’en-tête', () => {
    const parsed = parseMatrix(matrix(nominal, '| BUG-01 | [Score][Envoi] titre | S2 | P1 | Closed | abc123 |'))

    expect(parsed.requirements).toEqual([
      { id: 'REQ-SCORE-01', need: 'Un score est un entier entre 0 et le maximum', source: 'Cahier des charges §2' },
    ])
    expect(parsed.cases).toEqual([
      {
        id: 'TC-SCORE-01',
        requirement: 'REQ-SCORE-01',
        nature: 'nominal',
        level: 'unitaire',
        file: 'src/score.test.ts',
        title: 'accepte 0',
        status: 'PASSED',
        bug: null,
      },
    ])
    expect(parsed.bugs).toEqual([
      { id: 'BUG-01', title: '[Score][Envoi] titre', severity: 'S2', priority: 'P1', status: 'Closed', fix: 'abc123' },
    ])
  })
})

describe('checkMatrix', () => {
  it('accepte une matrice complète et cohérente', () => {
    expect(errorsOf(matrix(`${nominal}\n${error}`))).toEqual([])
  })

  it('traçabilité aval : une exigence sans cas d’erreur est signalée', () => {
    expect(errorsOf(matrix(nominal))).toEqual(['REQ-SCORE-01 : aucun cas de test « erreur »'])
  })

  it('traçabilité aval : une exigence sans aucun test est signalée (nominal et erreur)', () => {
    expect(errorsOf(matrix(''))).toEqual([
      'REQ-SCORE-01 : aucun cas de test « nominal »',
      'REQ-SCORE-01 : aucun cas de test « erreur »',
    ])
  })

  it('traçabilité amont : un test rattaché à une exigence inconnue est signalé', () => {
    const orphan = '| TC-X-01 | REQ-INCONNUE-01 | nominal | unitaire | `src/score.test.ts` › accepte 0 | PASSED | — |'

    expect(errorsOf(matrix(`${nominal}\n${error}\n${orphan}`))).toEqual([
      'TC-X-01 : exigence REQ-INCONNUE-01 absente du tableau des exigences',
    ])
  })

  it('refuse deux cas de test de même identifiant', () => {
    expect(errorsOf(matrix(`${nominal}\n${error}\n${nominal}`))).toEqual(['TC-SCORE-01 : identifiant en double'])
  })

  it('vérifie que la preuve existe : fichier présent et titre de test trouvé dedans', () => {
    const missingFile = error.replace('src/score.test.ts', 'src/absent.test.ts')
    const missingTitle = nominal.replace('accepte 0', 'accepte 42')

    expect(errorsOf(matrix(`${missingTitle}\n${missingFile}`))).toEqual([
      'TC-SCORE-01 : « accepte 42 » introuvable dans src/score.test.ts',
      'TC-SCORE-02 : fichier src/absent.test.ts introuvable',
    ])
  })

  it('refuse une nature, un statut ou une preuve mal formés', () => {
    const bad = '| TC-SCORE-03 | REQ-SCORE-01 | limite | unitaire | src/score.test.ts | OK | — |'

    expect(errorsOf(matrix(`${nominal}\n${error}\n${bad}`))).toEqual([
      'TC-SCORE-03 : nature « limite » (attendu : nominal ou erreur)',
      'TC-SCORE-03 : statut « OK » (attendu : PASSED, FAILED ou BLOCKED)',
      'TC-SCORE-03 : preuve « src/score.test.ts » (attendu : `fichier` › titre du test)',
    ])
  })

  it('un cas FAILED ou BLOCKED sans anomalie est une anomalie masquée', () => {
    const failed = error.replace('PASSED', 'FAILED')

    expect(errorsOf(matrix(`${nominal}\n${failed}`))).toEqual(['TC-SCORE-02 : statut FAILED sans anomalie rattachée'])
  })

  it('un cas FAILED rattaché à une anomalie ouverte est accepté', () => {
    const failed = error.replace('PASSED | — |', 'FAILED | BUG-01 |')
    const bug = '| BUG-01 | [Score][Envoi] refusé à tort | S1 | P0 | Open | — |'

    expect(errorsOf(matrix(`${nominal}\n${failed}`, bug))).toEqual([])
  })

  it('une anomalie citée doit exister ; un cas PASSED ne peut pointer qu’une anomalie close', () => {
    const unknown = nominal.replace('PASSED | — |', 'PASSED | BUG-09 |')
    const openBug = error.replace('PASSED | — |', 'PASSED | BUG-01 |')
    const bug = '| BUG-01 | [Score][Envoi] refusé à tort | S1 | P0 | Open | — |'

    expect(errorsOf(matrix(`${unknown}\n${openBug}`, bug))).toEqual([
      'TC-SCORE-01 : anomalie BUG-09 absente du tableau des anomalies',
      'TC-SCORE-02 : statut PASSED alors que BUG-01 est encore Open (re-test et clôture attendus)',
    ])
  })

  it('une anomalie doit être qualifiée : sévérité S0-S3, priorité P0-P3, statut du cycle ISTQB', () => {
    const bug = '| BUG-01 | titre | grave | urgent | Done | — |'

    expect(errorsOf(matrix(`${nominal}\n${error}`, bug))).toEqual([
      'BUG-01 : sévérité « grave » (attendu : S0, S1, S2 ou S3)',
      'BUG-01 : priorité « urgent » (attendu : P0, P1, P2 ou P3)',
      'BUG-01 : statut « Done » (attendu : New, Assigned, Open, Fixed, Retest, Closed ou Reopened)',
    ])
  })

  it('une anomalie close doit citer son correctif', () => {
    const bug = '| BUG-01 | titre | S2 | P1 | Closed | — |'

    expect(errorsOf(matrix(`${nominal}\n${error}`, bug))).toEqual(['BUG-01 : close sans correctif (commit ou PR)'])
  })
})
