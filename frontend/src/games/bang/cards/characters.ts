export type Character = 'bart-cassidy' | 'calamity-janet' | 'paul-regret' | 'willy-the-kid'

/** Nom, PV de départ et pouvoir de chaque personnage, identiques à ceux du back (`BangCharacter.java`). */
export const CHARACTERS: Record<Character, { label: string; lifePoints: number; power: string }> = {
  'bart-cassidy': {
    label: 'Bart Cassidy',
    lifePoints: 4,
    power: "Chaque fois qu'il perd un point de vie, il pioche une carte.",
  },
  'calamity-janet': {
    label: 'Calamity Janet',
    lifePoints: 4,
    power:
      'Elle peut jouer un BANG ! comme un Raté ! et inversement. Un Raté ! joué pour tirer compte comme son BANG ! du tour.',
  },
  'paul-regret': {
    label: 'Paul Regret',
    lifePoints: 3,
    power: 'Les autres joueurs le voient à une distance augmentée de 1. Sa distance vers eux reste normale.',
  },
  'willy-the-kid': {
    label: 'Willy le Kid',
    lifePoints: 4,
    power: "Il peut jouer autant de BANG ! qu'il veut pendant son tour.",
  },
}
