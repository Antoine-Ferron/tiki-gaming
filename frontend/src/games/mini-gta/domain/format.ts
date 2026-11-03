/** Montant en dollars à la française : « 1 200 $ ». */
export function formatMoney(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} $`
}
