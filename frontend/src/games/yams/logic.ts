/**
 * Règles du Yams, sans dépendance à React ni à la plateforme.
 *
 * Développé en TDD (voir CONTRIBUTING.md) : chaque fonction est d'abord décrite
 * par logic.test.ts, puis implémentée au minimum pour faire passer le test.
 */

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6
/** Toujours 5 dés. */
export type Dice = readonly [DieValue, DieValue, DieValue, DieValue, DieValue]
/** Un drapeau par dé : true = conservé au prochain lancer. */
export type Kept = readonly [boolean, boolean, boolean, boolean, boolean]

export const UPPER_CATEGORIES = ['as', 'deux', 'trois', 'quatre', 'cinq', 'six'] as const
export const LOWER_CATEGORIES = ['brelan', 'carre', 'full', 'petiteSuite', 'grandeSuite', 'yams', 'chance'] as const

export type UpperCategory = (typeof UPPER_CATEGORIES)[number]
export type LowerCategory = (typeof LOWER_CATEGORIES)[number]
export type Category = UpperCategory | LowerCategory

/** Face correspondant à chaque case de la section haute. */
export const UPPER_FACES: Record<UpperCategory, DieValue> = {
  as: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
}

export const CATEGORY_LABELS: Record<Category, string> = {
  as: 'As',
  deux: 'Deux',
  trois: 'Trois',
  quatre: 'Quatre',
  cinq: 'Cinq',
  six: 'Six',
  brelan: 'Brelan',
  carre: 'Carré',
  full: 'Full',
  petiteSuite: 'Petite suite',
  grandeSuite: 'Grande suite',
  yams: 'Yams',
  chance: 'Chance',
}

/**
 * Feuille de score : une case absente n'est pas encore jouée,
 * une case à 0 a été barrée volontairement.
 */
export type Sheet = Partial<Record<Category, number>>

export const UPPER_BONUS_THRESHOLD = 63
export const UPPER_BONUS = 35
export const FULL_SCORE = 25
export const PETITE_SUITE_SCORE = 30
export const GRANDE_SUITE_SCORE = 40
export const YAMS_SCORE = 50
export const MAX_ROLLS = 3
export const DICE_COUNT = 5

/** Lancer d'un dé. Injecté pour que les tests soient déterministes. */
export type RollDie = () => DieValue

export type Turn = {
  readonly dice: Dice
  readonly kept: Kept
  readonly rollsUsed: number
}

export function isUpperCategory(category: Category): category is UpperCategory {
  return (UPPER_CATEGORIES as readonly string[]).includes(category)
}

// --- Score d'une combinaison ---------------------------------------------

/** Nombre de dés par face : counts[4] = nombre de 4. */
function faceCounts(dice: Dice): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const die of dice) counts[die]++
  return counts
}

function sumDice(dice: Dice): number {
  return dice.reduce<number>((sum, die) => sum + die, 0)
}

/** Plus grand nombre de dés identiques : 3 pour un brelan, 5 pour un Yams. */
function maxOfAKind(dice: Dice): number {
  return Math.max(...faceCounts(dice))
}

/** Vrai si les dés contiennent `length` valeurs consécutives. */
function hasStraight(dice: Dice, length: number): boolean {
  const faces = new Set<number>(dice)
  for (let start = 1; start + length - 1 <= 6; start++) {
    let run = 0
    while (run < length && faces.has(start + run)) run++
    if (run === length) return true
  }
  return false
}

/** Score que vaudrait `dice` dans `category`. Plus haut = meilleur. */
export function scoreCategory(dice: Dice, category: Category): number {
  if (isUpperCategory(category)) {
    const face = UPPER_FACES[category]
    return dice.reduce<number>((sum, die) => (die === face ? sum + die : sum), 0)
  }
  switch (category) {
    case 'chance':
      return sumDice(dice)
    case 'yams':
      return dice.every((die) => die === dice[0]) ? YAMS_SCORE : 0
    case 'brelan':
      return maxOfAKind(dice) >= 3 ? sumDice(dice) : 0
    case 'carre':
      return maxOfAKind(dice) >= 4 ? sumDice(dice) : 0
    case 'full': {
      const counts = faceCounts(dice)
      return counts.includes(3) && counts.includes(2) ? FULL_SCORE : 0
    }
    case 'petiteSuite':
      return hasStraight(dice, 4) ? PETITE_SUITE_SCORE : 0
    case 'grandeSuite':
      return hasStraight(dice, 5) ? GRANDE_SUITE_SCORE : 0
  }
}

// --- Feuille de score ----------------------------------------------------

const ALL_CATEGORIES: readonly Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES]

/** Somme des cases déjà jouées parmi `categories`. */
function sumOf(sheet: Sheet, categories: readonly Category[]): number {
  return categories.reduce((sum, category) => sum + (sheet[category] ?? 0), 0)
}

/** Somme des six cases de la section haute déjà jouées. */
export function upperSubtotal(sheet: Sheet): number {
  return sumOf(sheet, UPPER_CATEGORIES)
}

/** UPPER_BONUS si la section haute atteint UPPER_BONUS_THRESHOLD, sinon 0. */
export function upperBonus(sheet: Sheet): number {
  return upperSubtotal(sheet) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0
}

/** Cases encore libres (une case barrée à 0 est jouée, donc absente). */
export function availableCategories(sheet: Sheet): Category[] {
  return ALL_CATEGORIES.filter((category) => sheet[category] === undefined)
}

/** Renvoie une NOUVELLE feuille. Lève si la case est déjà jouée. */
export function fillCategory(sheet: Sheet, category: Category, dice: Dice): Sheet {
  if (sheet[category] !== undefined) {
    throw new Error(`Case déjà jouée : ${CATEGORY_LABELS[category]}`)
  }
  return { ...sheet, [category]: scoreCategory(dice, category) }
}

// --- Tour de jeu ---------------------------------------------------------

export function canReroll(turn: Turn): boolean {
  return turn.rollsUsed < MAX_ROLLS
}

export function toggleKeep(turn: Turn, index: number): Turn {
  if (!Number.isInteger(index) || index < 0 || index >= DICE_COUNT) {
    throw new Error(`Dé inexistant : ${index}`)
  }
  const kept = turn.kept.map((isKept, i) => (i === index ? !isKept : isKept)) as unknown as Kept
  return { ...turn, kept }
}

/** Relance les dés non conservés. Lève s'il ne reste aucun lancer. */
export function reroll(turn: Turn, rollDie: RollDie): Turn {
  if (!canReroll(turn)) {
    throw new Error('Plus de lancer disponible')
  }
  const dice = turn.dice.map((die, i) => (turn.kept[i] ? die : rollDie())) as unknown as Dice
  return { ...turn, dice, rollsUsed: turn.rollsUsed + 1 }
}
