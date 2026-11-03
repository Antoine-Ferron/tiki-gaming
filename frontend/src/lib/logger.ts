import pino from 'pino'

// Journal du front (Pino, mode navigateur : sortie dans la console des devtools).
// Usage : logger.error({ err }, 'Message lisible') — jamais de mot de passe ni de jeton dans les logs.
export const logger = pino({ level: import.meta.env.DEV ? 'debug' : 'warn' })
