import pino from 'pino'

// Journal du front (Pino, mode navigateur : sortie dans la console des devtools). Muet pendant les tests.
// Usage : logger.error({ err }, 'Message lisible') — jamais de mot de passe ni de jeton dans les logs.
const level = import.meta.env.MODE === 'test' ? 'silent' : import.meta.env.DEV ? 'debug' : 'warn'

export const logger = pino({ level })
