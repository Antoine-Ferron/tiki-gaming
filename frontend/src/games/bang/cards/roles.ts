export type Role = 'sheriff' | 'deputy' | 'outlaw' | 'renegade'

/** Nom et objectif de chaque carte Rôle, identiques à ceux du back (`Role.java`). */
export const ROLES: Record<Role, { label: string; goal: string }> = {
  sheriff: {
    label: 'Shérif',
    goal: 'Doit éliminer tous les hors-la-loi et le Renégat pour faire régner la loi.',
  },
  deputy: {
    label: 'Adjoint',
    goal: "Aident et protègent le Shérif. Ils ont le même but que lui et ils l'accompliront coûte que coûte.",
  },
  outlaw: {
    label: 'Hors-la-loi',
    goal: "Ont envie de tuer le Shérif, mais ils n'ont aucun scrupule à s'entretuer pour ramasser les récompenses.",
  },
  renegade: {
    label: 'Renégat',
    goal: "Veut prendre la place du Shérif : son but est d'être le dernier personnage en jeu.",
  },
}
