import type { Client } from 'pg'

export const MIGRATIONS_DIR: string
export function parseMigrations(fileNames: string[]): { file: string; version: string; name: string }[]
export function applyMigrations(
  client: Client,
  options?: { dir?: string; log?: (message: string) => void },
): Promise<number>
