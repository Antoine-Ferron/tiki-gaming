// Matrice de traçabilité des exigences (RTM) : specs/rtm-matrix.md, vérifiée en CI par check-rtm.mjs.
// Trois tableaux Markdown : exigences (REQ), cas de test (TC) et anomalies (BUG).
import { fileURLToPath } from 'node:url'

export const RTM_FILE = fileURLToPath(new URL('../../specs/rtm-matrix.md', import.meta.url))
export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

const NATURES = ['nominal', 'erreur']
const STATUSES = ['PASSED', 'FAILED', 'BLOCKED']
const SEVERITIES = ['S0', 'S1', 'S2', 'S3']
const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
// Cycle de vie ISTQB d'une anomalie.
const BUG_STATUSES = ['New', 'Assigned', 'Open', 'Fixed', 'Retest', 'Closed', 'Reopened']
const NONE = '—'
// `chemin/du/fichier` › titre du test (ou du scénario Gherkin, ou nom de méthode JUnit)
const PROOF = /^`([^`]+)`\s*›\s*(.+)$/

/** Lignes du tableau qui suit le titre `## heading` (sans l'en-tête ni la ligne de séparation). */
function tableRows(markdown, heading) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`)
  if (start === -1) return []
  const rows = []
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    if (!line.trim().startsWith('|')) continue
    rows.push(
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
  }
  return rows.slice(2)
}

export function parseMatrix(markdown) {
  const requirements = tableRows(markdown, 'Exigences').map(([id, need, source]) => ({ id, need, source }))
  const cases = tableRows(markdown, 'Cas de test').map(([id, requirement, nature, level, proof, status, bug]) => {
    const match = PROOF.exec(proof)
    return {
      id,
      requirement,
      nature,
      level,
      file: match ? match[1] : null,
      title: match ? match[2] : proof,
      status,
      bug: bug === NONE || bug === '' ? null : bug,
    }
  })
  const bugs = tableRows(markdown, 'Anomalies').map(([id, title, severity, priority, status, fix]) => ({
    id,
    title,
    severity,
    priority,
    status,
    fix,
  }))
  return { requirements, cases, bugs }
}

const oneOf = (values) => values.slice(0, -1).join(', ') + ' ou ' + values.at(-1)

/**
 * Liste les ruptures de la chaîne de traçabilité. `readFile(chemin)` renvoie le contenu d'un fichier du dépôt, ou
 * null s'il n'existe pas.
 */
export function checkMatrix({ requirements, cases, bugs }, readFile) {
  const errors = []
  const requirementIds = new Set(requirements.map((r) => r.id))
  const bugsById = new Map(bugs.map((b) => [b.id, b]))
  const seen = new Set()

  // Traçabilité aval : chaque exigence a au moins un cas nominal et un cas d'erreur.
  for (const { id } of requirements) {
    for (const nature of NATURES) {
      if (!cases.some((c) => c.requirement === id && c.nature === nature)) {
        errors.push(`${id} : aucun cas de test « ${nature} »`)
      }
    }
  }

  for (const c of cases) {
    if (seen.has(c.id)) {
      errors.push(`${c.id} : identifiant en double`)
      continue
    }
    seen.add(c.id)
    // Traçabilité amont : chaque test justifie son existence par une exigence.
    if (!requirementIds.has(c.requirement)) {
      errors.push(`${c.id} : exigence ${c.requirement} absente du tableau des exigences`)
    }
    if (!NATURES.includes(c.nature)) errors.push(`${c.id} : nature « ${c.nature} » (attendu : ${oneOf(NATURES)})`)
    if (!STATUSES.includes(c.status)) errors.push(`${c.id} : statut « ${c.status} » (attendu : ${oneOf(STATUSES)})`)
    if (c.file === null) {
      errors.push(`${c.id} : preuve « ${c.title} » (attendu : \`fichier\` › titre du test)`)
    } else {
      const content = readFile(c.file)
      if (content === null) errors.push(`${c.id} : fichier ${c.file} introuvable`)
      else if (!content.includes(c.title)) errors.push(`${c.id} : « ${c.title} » introuvable dans ${c.file}`)
    }
    const bug = c.bug && bugsById.get(c.bug)
    if (c.bug && !bug) errors.push(`${c.id} : anomalie ${c.bug} absente du tableau des anomalies`)
    if ((c.status === 'FAILED' || c.status === 'BLOCKED') && !c.bug) {
      errors.push(`${c.id} : statut ${c.status} sans anomalie rattachée`)
    }
    if (c.status === 'PASSED' && bug && bug.status !== 'Closed') {
      errors.push(`${c.id} : statut PASSED alors que ${bug.id} est encore ${bug.status} (re-test et clôture attendus)`)
    }
  }

  for (const b of bugs) {
    if (!SEVERITIES.includes(b.severity)) {
      errors.push(`${b.id} : sévérité « ${b.severity} » (attendu : ${oneOf(SEVERITIES)})`)
    }
    if (!PRIORITIES.includes(b.priority)) {
      errors.push(`${b.id} : priorité « ${b.priority} » (attendu : ${oneOf(PRIORITIES)})`)
    }
    if (!BUG_STATUSES.includes(b.status)) {
      errors.push(`${b.id} : statut « ${b.status} » (attendu : ${oneOf(BUG_STATUSES)})`)
    } else if (b.status === 'Closed' && (!b.fix || b.fix === NONE)) {
      errors.push(`${b.id} : close sans correctif (commit ou PR)`)
    }
  }
  return errors
}
