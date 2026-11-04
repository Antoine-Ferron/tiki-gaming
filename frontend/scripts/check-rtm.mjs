#!/usr/bin/env node
// Vérifie la matrice de traçabilité specs/rtm-matrix.md (CI, job Traçabilité (RTM)) : zéro rupture de chaîne tolérée.
//   npm run rtm:check
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkMatrix, parseMatrix, REPO_ROOT, RTM_FILE } from './rtm.mjs'

const matrix = parseMatrix(readFileSync(RTM_FILE, 'utf8'))
const errors = checkMatrix(matrix, (path) => {
  const file = join(REPO_ROOT, path)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
})

if (errors.length > 0) {
  console.error(`Matrice de traçabilité : ${errors.length} rupture(s)\n${errors.map((e) => `- ${e}`).join('\n')}`)
  process.exitCode = 1
} else {
  const passed = matrix.cases.filter((c) => c.status === 'PASSED').length
  console.log(
    `${matrix.requirements.length} exigences, ${matrix.cases.length} cas de test (${passed} PASSED), ` +
      `${matrix.bugs.length} anomalies : traçabilité complète.`,
  )
}
