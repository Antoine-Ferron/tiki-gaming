export const RTM_FILE: string
export const REPO_ROOT: string

export type Requirement = { id: string; need: string; source: string }
export type TestCase = {
  id: string
  requirement: string
  nature: string
  level: string
  file: string | null
  title: string
  status: string
  bug: string | null
}
export type Bug = { id: string; title: string; severity: string; priority: string; status: string; fix: string }
export type Matrix = { requirements: Requirement[]; cases: TestCase[]; bugs: Bug[] }

export function parseMatrix(markdown: string): Matrix
export function checkMatrix(matrix: Matrix, readFile: (path: string) => string | null): string[]
