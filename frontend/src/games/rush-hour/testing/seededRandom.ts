/** Hasard reproductible pour les tests : même graine → même suite de nombres (algorithme mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    // `| 0` ramène l'état à un entier 32 bits qui « reboucle » au-delà de 2 147 483 647, comme le veut mulberry32.
    // `Math.trunc` (règle Sonar S7767) ne fait qu'enlever les décimales : l'état grandirait de 1,8 milliard à chaque
    // tirage et, passé 2^53 (vers le 4,9 millionième tirage), les additions seraient arrondies et la suite fausse.
    state = (state + 0x6d2b79f5) | 0 // NOSONAR : troncature 32 bits voulue, voir ci-dessus
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
