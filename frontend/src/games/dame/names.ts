import * as z from 'zod/mini'

function name(label: string) {
  return z
    .string()
    .check(z.trim(), z.minLength(1, `Indique le nom du joueur ${label}.`), z.maxLength(50, '50 caractères maximum.'))
}

export const namesSchema = z.object({ whiteName: name('blanc'), blackName: name('noir') })
